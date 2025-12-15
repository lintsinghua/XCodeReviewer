# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2024-12-15

### Highlights

**DeepAudit v3.0.0** introduces a revolutionary **Multi-Agent Intelligent Audit System**:

- Multi-Agent Architecture with Orchestrator-driven decision making
- RAG (Retrieval-Augmented Generation) knowledge base enhancement
- Docker sandbox for automated vulnerability verification
- Professional security tool integration

### Added

#### Multi-Agent Architecture
- **Orchestrator Agent**: Centralized orchestration for autonomous audit strategy decisions
- **Recon Agent**: Information gathering, technology stack identification, and entry point discovery
- **Analysis Agent**: Deep vulnerability analysis with Semgrep, RAG semantic search, and LLM analysis
- **Verification Agent**: Sandbox testing, PoC generation, false positive filtering

#### RAG Knowledge Base
- Code semantic understanding with Tree-sitter AST-based chunking
- CWE/CVE vulnerability knowledge base integration
- Milvus/ChromaDB vector database support
- Multi-language support: Python, JavaScript, TypeScript, Java, Go, PHP, Rust

#### Security Sandbox
- Docker isolated container for PoC execution
- Resource limits: memory, CPU constraints
- Network isolation with configurable access
- seccomp security policies

#### Security Tools Integration
- **Semgrep**: Multi-language static analysis
- **Bandit**: Python security scanning
- **Gitleaks**: Secret leak detection
- **TruffleHog**: Deep secret scanning
- **npm audit**: Node.js dependency vulnerabilities
- **Safety**: Python dependency audit
- **OSV-Scanner**: Multi-language dependency vulnerabilities

#### New Features
- Kunlun-M (MIT License) security scanner integration
- File upload size limit increased to 500MB with large file optimization
- Improved task tabs with card-style layout
- Enhanced error handling and project scope filtering
- Streaming LLM token usage reporting with input estimation

### Changed
- Refactored Agent architecture with dynamic Agent tree
- Expanded high-risk file patterns and dangerous pattern library
- Enhanced sandbox functionality with forced sandbox verification
- Improved report generation with normalized severity comparisons
- Better agent stream stability preventing unnecessary reconnections

### Fixed
- Agent stream stability issues with correct event buffer draining
- Sandbox tool initialization logging improvements
- Task phase update to REPORTING on completion
- Various UI/UX improvements in AgentAudit component

---

## [2.0.0] - 2024-11-15

### Added
- Multi-LLM platform support (OpenAI, Claude, Gemini, Qwen, DeepSeek, Zhipu, etc.)
- Ollama local model support for privacy-focused deployments
- Project management with GitHub/GitLab import
- ZIP file upload support
- Instant code analysis feature
- What-Why-How three-step fix recommendations
- PDF/JSON report export
- Audit rules management (OWASP Top 10 built-in)
- Prompt template management with visual editor
- Runtime LLM configuration in browser
- i18n support (Chinese/English)

### Changed
- Migrated to FastAPI backend
- React 18 frontend with TypeScript
- PostgreSQL database with Alembic migrations
- Docker Compose deployment support

---

## [1.0.0] - 2024-10-01

### Added
- Initial release
- Basic code security audit functionality
- LLM-powered vulnerability detection
- Simple web interface
