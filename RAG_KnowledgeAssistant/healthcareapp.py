import streamlit as st
from langchain_community.vectorstores import FAISS
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.prompts import SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.runnables import RunnableMap, RunnableLambda
from langchain_openai import OpenAIEmbeddings

from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

@st.cache_resource
def build_chain():
    # 1. Load your vectorstore (FAISS example)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    #FAISS.load_local("faiss_index_healthcare", embeddings)
    vectorstore = FAISS.load_local("faiss_index_healthcare", embeddings, allow_dangerous_deserialization=True)  # embeddings must be the same model used for saving
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    # 2. (Re)create your prompt, LLM, and chain
    system_message = SystemMessagePromptTemplate.from_template(
        "You are a helpful healthcare assistant. Answer clearly and patiently. If answer not in the context, just say I DONT KNOW!"
    )
    human_message = HumanMessagePromptTemplate.from_template(
        "Use the following context to answer the user's question:\n\n{context}\n\nQuestion: {input}\nAnswer:"
    )
    prompt = ChatPromptTemplate.from_messages([system_message, human_message])
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    combine_docs_chain = create_stuff_documents_chain(llm, prompt)
    qa_chain = (
        RunnableMap({
            "input": lambda x: x["input"],
            "context": lambda x: retriever.invoke(x["input"])
        })
        | RunnableLambda(lambda inputs: {
            "answer": combine_docs_chain.invoke(inputs),
            "source_documents": inputs["context"]
        })
    )
    return qa_chain

qa_chain = build_chain()

# 3. Streamlit UI (as before)
st.title("Healthcare RAG Chatbot")
question = st.text_input("Ask a medical question:")
if st.button("Ask") and question.strip():
    with st.spinner("Thinking..."):
        result = qa_chain.invoke({"input": question})
        st.write(result["answer"])
        with st.expander("Show Source Chunks"):
            for doc in result["source_documents"]:
                st.write(f"[source: {doc.metadata.get('source')}, chunk {doc.metadata.get('chunk_id')}]")
                st.write(doc.page_content)
