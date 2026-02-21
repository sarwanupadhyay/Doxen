
Doxen - Level 0 Data Flow Diagram (Context Diagram)
External Entities
User

Business Analysts
Product Managers
Project Stakeholders

Slack API

Slack Workspace
Channel Messages

Email Systems

Gmail
Outlook
Other Email Providers

LLM Services

AI Gateway (Gemini Flash)
Google AI API

The System: Doxen BRD Generator
Data Flows
Inputs to Doxen:
From User:

User credentials (login/signup)
Project details (name, description)
Uploaded documents (PDF, DOCX, TXT)
Pasted text/transcripts
Natural language refinement commands
Export requests

From Slack API:

Channel list
Channel messages
Message metadata

From Email Systems:

Email threads
Attachments
Email metadata

From LLM Services:

AI-generated requirements
Generated BRD content
Refinement responses

Outputs from Doxen:
To User:

Authentication tokens
Dashboard view
Project list
Extracted requirements
Generated BRD (PDF/Markdown)
Traceability reports
Success/error messages

To Slack API:

OAuth authorization requests
Channel query requests
Message fetch requests

To Email Systems:

Confirmation emails
Notification emails

To LLM Services:

Source content for analysis
Requirement extraction prompts
BRD generation prompts
Refinement instructions


Visual Representation for Napkin AI:
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
    │         DOXEN SYSTEM              │
    │   (AI-Powered BRD Generator)      │
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

Data Flow Summary
Entity → Doxen:

User → Authentication data, source documents, commands
Slack API → Channel messages, metadata
Email Systems → Email threads, attachments
LLM Services → AI analysis results

Doxen → Entity:

Doxen → User: BRD documents, requirements, reports
Doxen → Slack API: Data fetch requests
Doxen → Email Systems: Notifications
Doxen → LLM Services: Analysis prompts
