import { KEYS } from './storage.js';

function formatDuration(ms) {
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 1) return '< 1m';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function calculateStreak(history) {
  const dates = Object.keys(history).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let current = new Date();
  
  while (true) {
    const dateStr = current.toLocaleDateString('en-CA');
    const dayData = history[dateStr];
    const sessions = dayData ? (dayData.focusSessions || []) : [];
    
    if (sessions.length > 0) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      // If it's today and empty, check yesterday to continue streak
      if (streak === 0 && dateStr === new Date().toLocaleDateString('en-CA')) {
        current.setDate(current.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

function calculateConsistency(dailyMs) {
  if (dailyMs.length < 2) return 0;
  const avg = dailyMs.reduce((a, b) => a + b, 0) / dailyMs.length;
  if (avg === 0) return 0;
  
  const squareDiffs = dailyMs.map(ms => Math.pow(ms - avg, 2));
  const variance = squareDiffs.reduce((a, b) => a + b, 0) / dailyMs.length;
  const stdDev = Math.sqrt(variance);
  
  // Consistency score: 100% - (CV * 100). Higher CV = Lower Consistency.
  const cv = stdDev / avg;
  let score = Math.round((1 - Math.min(cv, 1)) * 100);
  return score;
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['siteTime', 'history', KEYS.TASKS], (data) => {
    const siteTime = data.siteTime || {};
    const history = data.history || {};
    const tasks = data[KEYS.TASKS] || [];

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    const last7Days = [];
    // Check from 7 days ago until "tomorrow" to catch UTC-future logs
    for (let i = 6; i >= -1; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      last7Days.push(d.toLocaleDateString('en-CA'));
    }

    // ── 1. CALCULATE CORE METRICS ─────────────────────────────────
    let totalFocusMs = 0;
    const hourlyBuckets = Array(24).fill(0);
    const dailyMsArr = [];
    
    // Focus Session Data
    const dailyMomentum = last7Days.map(date => {
      const dayData = history[date] || {};
      const sessions = dayData.focusSessions || [];
      const dayMs = sessions.reduce((acc, s) => acc + s.durationMs, 0);
      
      totalFocusMs += dayMs;
      dailyMsArr.push(dayMs);
      
      sessions.forEach(s => {
        const hour = new Date(s.startTime).getHours();
        hourlyBuckets[hour] += s.durationMs;
      });
      
      return { label: date.split('-').slice(1).join('/'), ms: dayMs };
    });

    // Task Time Data (Add to total if not in focus history)
    let totalTaskMs = 0;
    tasks.forEach(t => {
      const taskTotal = (t.totalTimeMs || 0) + (t.activeStartTime ? (Date.now() - t.activeStartTime) : 0);
      totalTaskMs += taskTotal;
    });

    const grandTotalMs = totalFocusMs + totalTaskMs;

    if (grandTotalMs < 10000) { // Threshold: 10 seconds
      document.getElementById('empty-state').classList.remove('hidden');
      document.getElementById('main-content').classList.add('hidden');
      return;
    }
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');

    // Update Metric Cards
    document.getElementById('metric-total-focus').textContent = formatDuration(grandTotalMs);
    
    // Trend: Today vs Yesterday
    const todayMs = (history[todayStr]?.focusSessions || []).reduce((a, s) => a + s.durationMs, 0);
    const yesterdayMs = (history[yesterdayStr]?.focusSessions || []).reduce((a, s) => a + s.durationMs, 0);
    const trendEl = document.getElementById('trend-focus');
    if (yesterdayMs > 0) {
      const change = Math.round(((todayMs - yesterdayMs) / yesterdayMs) * 100);
      trendEl.textContent = `${change >= 0 ? '+' : ''}${change}% vs yesterday`;
      trendEl.className = `metric-change ${change >= 0 ? 'change-up' : 'change-down'}`;
    } else if (todayMs > 0) {
      trendEl.textContent = 'Momentum started! 🚀';
      trendEl.className = 'metric-change change-up';
    } else {
      trendEl.textContent = 'No activity yet today';
      trendEl.className = 'metric-change';
    }

    // Streak
    document.getElementById('metric-streak').textContent = `${calculateStreak(history)} days`;

    // Peak Hour
    const peakHour = hourlyBuckets.indexOf(Math.max(...hourlyBuckets));
    document.getElementById('metric-peak-hour').textContent = formatHour(peakHour);

    // Consistency
    const consistencyScore = calculateConsistency(dailyMsArr);
    document.getElementById('metric-consistency').textContent = `${consistencyScore}%`;
    const consInsight = document.getElementById('consistency-insight');
    if (consistencyScore > 70) {
      consInsight.textContent = 'High Consistency 🎯';
      consInsight.className = 'metric-change change-up';
    } else if (consistencyScore > 40) {
      consInsight.textContent = 'Moderate Variation';
      consInsight.className = 'metric-change';
    } else {
      consInsight.textContent = 'Highly Irregular';
      consInsight.className = 'metric-change change-down';
    }

    // ── 2. RENDER DAILY FOCUS CHART (LINE GRAPH) ──────────────────
    const dailyXAxis = document.getElementById('daily-x-axis');
    const dailyYAxis = document.getElementById('daily-y-axis');
    const graphLine = document.getElementById('graph-line');
    const graphPoints = document.getElementById('graph-points');
    const svgWrapper = document.getElementById('daily-focus-chart');
    
    // Ensure we have a valid max for scaling
    const maxDailyMs = Math.max(...dailyMomentum.map(d => d.ms), 3600000); 
    const totalMaxMinutes = Math.ceil(maxDailyMs / 60000);
    const interval = totalMaxMinutes > 120 ? 60 : 30;
    const maxMinutes = Math.ceil(totalMaxMinutes / interval) * interval;
    
    // Update Y-Axis to Minutes
    dailyYAxis.innerHTML = '';
    for (let i = maxMinutes; i >= 0; i -= interval) {
      const span = document.createElement('span');
      span.textContent = `${i}m`;
      dailyYAxis.appendChild(span);
    }

    // Update X-Axis & Calculate Points
    dailyXAxis.innerHTML = '';
    graphPoints.innerHTML = ''; // Clear old points
    
    const points = [];
    const width = svgWrapper.clientWidth;
    const height = 160; 
    const paddingX = 20; // Give some breathing room at edges
    const effectiveWidth = width - (paddingX * 2);
    const stepX = effectiveWidth / (dailyMomentum.length - 1);

    dailyMomentum.forEach((day, i) => {
      const px = paddingX + (i * stepX);
      const py = height - (day.ms / (maxMinutes * 60000)) * height;
      points.push(`${px},${py}`);

      // X-Label
      const label = document.createElement('span');
      label.className = 'x-label';
      label.style.left = `${px}px`;
      label.style.position = 'absolute';
      label.textContent = day.label;
      dailyXAxis.appendChild(label);

      // Circle point
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', px);
      circle.setAttribute('cy', py);
      circle.setAttribute('r', '4');
      circle.setAttribute('class', 'data-point');
      
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${day.label}: ${formatDuration(day.ms)}`;
      circle.appendChild(title);
      graphPoints.appendChild(circle);
    });

    graphLine.setAttribute('d', `M ${points.join(' L ')}`);

    // Momentum Insight
    const momentumBox = document.getElementById('insight-momentum');
    if (todayMs > 0 && yesterdayMs > 0) {
      const change = Math.round(((todayMs - yesterdayMs) / yesterdayMs) * 100);
      if (change > 0) {
        momentumBox.textContent = `Your focus is trending upwards today! You've improved your productivity by ${change}% compared to yesterday.`;
      } else if (change < 0) {
        momentumBox.textContent = `You're a bit behind yesterday's pace (-${Math.abs(change)}%). A quick 15-minute session could help you close the gap!`;
      } else {
        momentumBox.textContent = "You're exactly on track with yesterday's performance. Keep it up!";
      }
    } else if (todayMs > 0) {
      momentumBox.textContent = `Great start! You've already logged ${formatDuration(todayMs)} of focus today. Keep this momentum going to build a strong streak.`;
    } else {
      momentumBox.textContent = "Start your first focus session of the day to see your momentum grow and earn your consistency points!";
    }

    // ── 3. RENDER HOURLY DISTRIBUTION & FILTER ───────────────────
    const hourlyChart = document.getElementById('hourly-focus-chart');
    const daySelector = document.getElementById('day-selector');
    const hourlyBox = document.getElementById('insight-hourly');

    // Populate day selector
    last7Days.forEach(date => {
      const opt = document.createElement('option');
      opt.value = date;
      opt.textContent = date.split('-').slice(1).join('/'); // MM/DD
      daySelector.appendChild(opt);
    });

    const renderHourly = (filterDate) => {
      const currentBuckets = Array(24).fill(0);
      
      if (filterDate === 'all') {
        last7Days.forEach(date => {
          (history[date]?.focusSessions || []).forEach(s => {
            const h = new Date(s.startTime).getHours();
            currentBuckets[h] += s.durationMs;
          });
        });
      } else {
        (history[filterDate]?.focusSessions || []).forEach(s => {
          const h = new Date(s.startTime).getHours();
          currentBuckets[h] += s.durationMs;
        });
      }

      const maxHourly = Math.max(...currentBuckets, 60000);
      hourlyChart.innerHTML = '';
      
      currentBuckets.forEach((ms, h) => {
        const height = (ms / maxHourly) * 100;
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.style.flex = '1';
        col.style.height = '100%';
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.justifyContent = 'flex-end';
        col.style.alignItems = 'center';
        col.style.gap = '4px';

        const bar = document.createElement('div');
        bar.className = 'bar-rect';
        bar.style.width = '100%';
        bar.style.height = '0%';
        bar.style.background = 'linear-gradient(to top, var(--clr-accent), var(--clr-cyan))';
        bar.style.borderRadius = '2px';
        bar.style.transition = 'height 1s ease';

        const lbl = document.createElement('span');
        lbl.className = 'bar-label';
        lbl.style.fontSize = '0.5rem';
        lbl.style.color = 'var(--clr-muted)';
        lbl.textContent = h % 6 === 0 ? formatHour(h).split(' ')[0] : '';

        col.append(bar, lbl);
        hourlyChart.appendChild(col);
        setTimeout(() => bar.style.height = `${Math.max(height, 2)}%`, 100);
      });

      const peakH = currentBuckets.indexOf(Math.max(...currentBuckets));
      hourlyBox.textContent = filterDate === 'all' 
        ? `On average, you are most productive around ${formatHour(peakH)}.`
        : `On ${filterDate.split('-').slice(1).join('/')}, your peak productivity was at ${formatHour(peakH)}.`;
    };

    daySelector.addEventListener('change', (e) => renderHourly(e.target.value));
    renderHourly('all'); // Initial render

    // ── 4. RENDER TOP SITES ────────────────────────────────────────
    const siteListContainer = document.getElementById('site-list');
    const siteAggregate = {};
    let totalSiteTime = 0;
    
    last7Days.forEach(date => {
      const dayData = siteTime[date] || {};
      for (const [domain, duration] of Object.entries(dayData)) {
        if (domain.includes(chrome.runtime.id)) continue;
        siteAggregate[domain] = (siteAggregate[domain] || 0) + duration;
        totalSiteTime += duration;
      }
    });

    const sortedSites = Object.entries(siteAggregate)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sortedSites.length > 0) {
      const maxSiteDur = sortedSites[0][1];
      siteListContainer.innerHTML = '';
      sortedSites.forEach(([domain, duration]) => {
        const percentOfMax = (duration / maxSiteDur) * 100;
        const percentOfTotal = Math.round((duration / totalSiteTime) * 100);
        
        const item = document.createElement('div');
        item.className = 'site-item';
        item.innerHTML = `
          <div class="site-info">
            <span class="site-name">${domain}</span>
            <span class="site-meta">${formatDuration(duration)} (${percentOfTotal}%)</span>
          </div>
          <div class="site-bar-container">
            <div class="site-bar-fill" style="width: 0%"></div>
          </div>
        `;
        siteListContainer.appendChild(item);
        setTimeout(() => {
          item.querySelector('.site-bar-fill').style.width = `${percentOfMax}%`;
        }, 500);
      });
    } else {
      siteListContainer.innerHTML = '<div class="empty-state" style="padding: 1rem;">No browsing data recorded.</div>';
    }

    // ── 5. RENDER TASK PERFORMANCE ────────────────────────────────
    const taskListContainer = document.getElementById('task-list');
    const sortedTasks = tasks
      .map(t => ({
        ...t,
        total: (t.totalTimeMs || 0) + (t.activeStartTime ? (Date.now() - t.activeStartTime) : 0)
      }))
      .filter(t => t.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    if (sortedTasks.length === 0) {
      taskListContainer.innerHTML = '<div class="empty-state" style="padding: 1rem;">Start tracking a task to see metrics.</div>';
    } else {
      const maxTaskDur = sortedTasks[0].total;
      taskListContainer.innerHTML = '';
      sortedTasks.forEach(t => {
        const percent = (t.total / maxTaskDur) * 100;
        const item = document.createElement('div');
        item.className = 'site-item';
        item.innerHTML = `
          <span class="site-name">${t.text}</span>
          <div class="site-bar-container">
            <div class="site-bar-fill" style="width: 0%; background: var(--clr-accent);"></div>
          </div>
          <span class="site-time">${formatDuration(t.total)}</span>
        `;
        taskListContainer.appendChild(item);
        setTimeout(() => {
          item.querySelector('.site-bar-fill').style.width = `${percent}%`;
        }, 700);
      });
    }
  });
});
