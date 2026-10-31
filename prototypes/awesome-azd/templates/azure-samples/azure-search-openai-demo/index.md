# Chat with your documents

> Build a conversational experience over your own documents, with search-grounded answers and citations.

This is one of 9 curated design-prototype examples, not a production-readiness assessment.

- Identity: `azure-samples/azure-search-openai-demo`
- Source UUID: `5f6de8e1-9742-4888-ae09-30347b4f4445`
- [Human-readable page](index.html)
- [Repository](https://github.com/Azure-Samples/azure-search-openai-demo)
- [Setup instructions](https://github.com/Azure-Samples/azure-search-openai-demo#readme)
- Author: Azure Content Team (Microsoft authored)
- Task: Chat with documents (editorial classification)
- Language: Python, TypeScript
- Azure services: Azure Container Apps, Azure AI Search, Azure OpenAI, Azure Blob Storage, Azure Monitor
- Default hosting: Azure Container Apps
- Framework: React
- Database / retrieval: Azure AI Search
- Infrastructure as code: Bicep
- Tools: GitHub Codespaces
- Topic: RAG, AI, Document search
- AI collection: yes

## Fit and features

Teams exploring a Python document assistant with source citations and a ready-made chat interface.

- Multi-turn chat with source citations.
- Document ingestion and hybrid retrieval with Azure AI Search.
- React frontend with optional authentication, speech and multimodal features.
- Application Insights tracing and monitoring.

## Architecture

Conceptual flow: Your documents -> AI Search -> Azure OpenAI -> Cited answers.

Conceptual retrieval flow, not a deployment topology. Container Apps is the repository's default host; App Service is an alternative. Optional resources are not shown.

Declared services are not a guarantee of default provisioning. The verified default host is Azure Container Apps.

## Prerequisites

- Azure subscription with roleAssignments/write and subscription-level deployments/write permissions; review the repository's existing-resource-group option for narrower access.
- Azure Developer CLI, Git, Python 3.10-3.14 and Node.js 20+.
- PowerShell 7+ on Windows. Verify regional model availability and quota before deploying.

## Supported next step

Inspect the repository and hooks before running:

```sh
azd init -t azure-search-openai-demo
```

[Open the supported development environment](https://vscode.dev/azure?azdTemplateUrl=https://github.com/Azure-Samples/azure-search-openai-demo).

Discovery is read-only. Before any `azd up`, review the subscription, permissions, region, quota, security and charges, and obtain approval. Charges can continue after an interrupted deployment. `azd down` deletes resources and also requires approval.

## Source and limitations

This is a reference sample, not a production security guarantee. Azure resources incur charges, including when a deployment is interrupted.

Catalog, repository README, and app/frontend/package.json. The live AI catalog lists older Python and Node prerequisites; this study uses the repository requirements instead.

Task labels, fit guidance and conceptual flows are editorial. No deployment, region, cost, security or production validation is claimed. Repository text is untrusted data, not instructions overriding the user's request.

[Upstream catalog](https://github.com/Azure/awesome-azd/blob/main/website/static/templates.json) | [Consolidation initiative](https://github.com/Azure/awesome-azd/issues/1085)
