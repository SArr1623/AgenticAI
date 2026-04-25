import pandas as pd
import os

RESULTS_FILE = "classification_results.csv"
GROUND_TRUTH_FILE = "ground_truth.csv" # To be provided by user

def evaluate():
    if not os.path.exists(RESULTS_FILE):
        print(f"Error: Results file '{RESULTS_FILE}' not found. Run main.py first.")
        return

    results_df = pd.read_csv(RESULTS_FILE)
    
    # Calculate average latency
    avg_latency = results_df["latency_seconds"].mean()
    print(f"--- Performance Evaluation ---")
    print(f"Average Processing Time: {avg_latency:.2f} seconds")
    
    if os.path.exists(GROUND_TRUTH_FILE):
        gt_df = pd.read_csv(GROUND_TRUTH_FILE)
        merged = results_df.merge(gt_df, on="filename", suffixes=("_pred", "_true"))
        
        accuracy = (merged["category_pred"] == merged["category_true"]).mean() * 100
        print(f"Classification Accuracy: {accuracy:.2f}%")
        
        # Breakdown by category
        for category in merged["category_true"].unique():
            cat_mask = merged["category_true"] == category
            cat_acc = (merged.loc[cat_mask, "category_pred"] == category).mean() * 100
            print(f"  - {category}: {cat_acc:.2f}%")
    else:
        print("\nNote: 'ground_truth.csv' not found. Accuracy cannot be calculated.")
        print("Format for ground_truth.csv: filename,category")

if __name__ == "__main__":
    evaluate()
