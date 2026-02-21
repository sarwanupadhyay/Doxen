# Doxen 🚀

AI-powered Business Requirements Document generator that transforms scattered communications into professional, structured documentation.

## What is Doxen?

Doxen automatically converts emails, Slack messages, meeting transcripts, and documents into comprehensive Business Requirements Documents (BRDs) - saving hours of manual work while improving accuracy and traceability.

## Key Features

- **Multi-Source Integration** - Import from Slack channels, upload documents, paste meeting transcripts
- **AI-Powered Extraction** - Automatically identifies and categorizes functional & non-functional requirements
- **Complete Traceability** - Every requirement linked back to its source with confidence scores
- **Natural Language Refinement** - Update documents with simple commands like "Add a security section"
- **Professional Output** - Export as PDF or Markdown with standardized BRD structure
- **Version Control** - Track all document iterations automatically

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **AI:** Lovable AI Gateway (Gemini Flash) or OpenAI/Google AI
- **Integrations:** Slack Web API

## Quick Start
```bash
# Clone repository
git clone <your-repo-url>
cd doxen

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials

# Run development server
npm run dev
```

Visit `http://localhost:8080`

## Documentation

- **[User Flow](./docs/USER_FLOW.md)** - Complete user journey documentation
- **[Setup Guide](./SETUP.md)** - Detailed installation and configuration
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and technical decisions

## How It Works

1. **Add Sources** - Upload documents, import Slack channels, paste transcripts
2. **Extract Requirements** - AI analyzes all sources and extracts structured requirements
3. **Generate BRD** - AI creates a professional Business Requirements Document
4. **Refine & Export** - Use natural language to refine, then export as PDF/Markdown

## Example Use Case

**Before Doxen:** 8-12 hours manually reading through 50+ Slack messages, 10 emails, and 3 meeting transcripts to create a BRD.

**After Doxen:** 15 minutes to upload sources, extract requirements, and generate a professional BRD with full traceability.

## Project Status

🚧 **In Development** - Active prototyping and feature development

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](./LICENSE) for details

## Contact

For questions or feedback, reach out at [your-email] or open an issue.

---

Built with ❤️ to make requirement documentation effortless.
