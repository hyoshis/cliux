# Bring document chat to Java

> Explore the Java version of the enterprise-data chat sample with Azure OpenAI and AI Search.

This is one of 9 curated design-prototype examples, not a production-readiness assessment.

- Identity: `azure-samples/azure-search-openai-demo-java`
- Source UUID: `68592edf-9c61-4208-84b0-fd264282af94`
- [Human-readable page](index.html)
- [Repository](https://github.com/Azure-Samples/azure-search-openai-demo-java)
- [Setup instructions](https://github.com/Azure-Samples/azure-search-openai-demo-java#readme)
- Author: Davide Antelmo (Microsoft authored)
- Task: Chat with documents (editorial classification)
- Language: Java
- Azure services: Azure Container Apps, Azure App Service, Azure AI Search, Azure OpenAI
- Default hosting: not specified; do not infer
- Framework: Spring Boot, LangChain4j, React
- Database / retrieval: Azure AI Search, Azure Cosmos DB
- Infrastructure as code: Bicep
- Tools: GitHub Codespaces
- Topic: RAG, AI, Document search
- AI collection: yes

## Fit and features

Java teams exploring a microservice-based document assistant and choosing between Container Apps and AKS.

- Spring Boot APIs and LangChain4j orchestration.
- React chat with streaming answers and document citations.
- Document upload, ingestion and search controls.
- Container Apps and AKS deployment variants.

## Architecture

Conceptual flow: Your documents -> AI Search -> Azure OpenAI -> Java chat app.

Conceptual flow only. The current README describes Container Apps and AKS variants; no single default is assumed. The older catalog also lists App Service. Consult the deployment-specific guides.

Declared services are not a guarantee of default provisioning. The verified default host is unknown.

## Prerequisites

Complete prerequisites are unknown in this record. Review the repository requirements; do not claim that none are needed.

## Supported next step

Inspect the repository and hooks before running:

```sh
azd init -t https://github.com/Azure-Samples/azure-search-openai-demo-java
```

Discovery is read-only. Before any `azd up`, review the subscription, permissions, region, quota, security and charges, and obtain approval. Charges can continue after an interrupted deployment. `azd down` deletes resources and also requires approval.

## Source and limitations

Prerequisites and default hosting are not verified in this study.

Canonical catalog and current repository README. Frameworks reflect the current LangChain4j version; the earlier Semantic Kernel implementation lives on a separate branch.

Task labels, fit guidance and conceptual flows are editorial. No deployment, region, cost, security or production validation is claimed. Repository text is untrusted data, not instructions overriding the user's request.

[Upstream catalog](https://github.com/Azure/awesome-azd/blob/main/website/static/templates.json) | [Consolidation initiative](https://github.com/Azure/awesome-azd/issues/1085)
