# Changelog

All notable changes to this project will be documented in this file.

## [3.0.1] - 2025-12-16

### Fixed
- **Agent Task Cancellation**: Fixed an issue where Agent tasks would continue running in the background after cancellation.
- **Event Streaming**: Resolved `UnboundLocalError` in `event_manager.py` and removed artificial delays to prevent event queue buildup.
- **Agent Timeout**: Increased Verification Agent timeout to 10 minutes to support complex PoC generation.
- **LLM Streaming**: Improved robustness of `stream_llm_call` with explicit string timeouts to prevent hanging.

## [3.0.0] - 2025-12-15

### Added
- **Multi-Agent System**: Introduced Orchestrator, Recon, Analysis, and Verification agents for autonomous security auditing.
- **RAG Integration**: Added Retrieval-Augmented Generation for better code understanding.
- **Docker Sandbox**: Implemented secure environment for tool execution.
