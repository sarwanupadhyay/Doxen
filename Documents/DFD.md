# Doxen - Level 0 Data Flow Diagram (Context Diagram)

## 1. External Entities

### User
* Business Analysts
* Product Managers
* Project Stakeholders

### Slack API
* Slack Workspace
* Channel Messages

### Email Systems
* Gmail
* Outlook
* Other Email Providers

### LLM Services
* AI Gateway (Gemini Flash)
* Google AI API

---

## 2. The System: Doxen BRD Generator

### Inputs to Doxen

**From User:**
* User credentials (login/signup)
* Project details (name, description)
* Uploaded documents (PDF, DOCX, TXT)
* Pasted text/transcripts
* Natural language refinement commands
* Export requests

**From Slack API:**
* Channel list
* Channel messages
* Message metadata

**From Email Systems:**
* Email threads
* Attachments
* Email metadata

**From LLM Services:**
* AI-generated requirements
* Generated BRD content
* Refinement responses

### Outputs from Doxen

**To User:**
* Authentication tokens
* Dashboard view
* Project list
* Extracted requirements
* Generated BRD (PDF/Markdown)
* Traceability reports
* Success/error messages

**To Slack API:**
* OAuth authorization requests
* Channel query requests
* Message fetch requests

**To Email Systems:**
* Confirmation emails
* Notification emails

**To LLM Services:**
* Source content for analysis
* Requirement extraction prompts
* BRD generation prompts
* Refinement instructions

---

## 3. Visual Representation (Napkin AI)

```text
    ┌─────────────────┐
    │                 │
    │      USER       │
    │                 │
    └────────┬────────┘
             │
             │ Login credentials, documents, transcripts, commands
             │
             ↓
        ┌────────────────────────────────────┐
        │                                    │
        │             DOXEN SYSTEM           │
        │       (AI-Powered BRD Generator)   │
        │                                    │
        │  • Authentication                  │
        │  • Data Source Management          │
        │  • Requirement Extraction          │
        │  • BRD Generation                  │
        │  • Document Export                 │
        │                                    │
        └────┬──────┬──────┬──────┬─────────┘
             │      │      │      │
             │      │      │      │
             ↓      ↓      ↓      ↓
        ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
        │ Slack  │ │ Email  │ │  LLM   │ │ User   │
        │  API   │ │ System │ │Service │ │        │
        └────────┘ └────────┘ └────────┘ └────────┘
