# Doxen User Flow

## Overview
This document outlines the user journey through the Doxen AI-Powered BRD Generator application.

---

## User Flow Diagram

### 1. Entry Point
**Landing Page**
- User arrives at the application
- Views product information and features
- Clicks "Sign In" or "Sign Up"

### 2. Authentication
**Auth Page**
- **New Users:**
  - Sign up with Email + Password OR Google OAuth
  - Receive confirmation email (for email auth)
  - Redirected to Username Setup
  - Create unique username
  - Proceed to Dashboard
  
- **Returning Users:**
  - Sign in with credentials
  - Directly access Dashboard

### 3. Dashboard
**Projects Overview**
- View all existing projects
- **User Actions:**
  - Create new project → Enter project details (name, description)
  - Select existing project → Open Project Workspace

### 4. Project Workspace
Main working area with multiple tabs and sections

#### 4.1 Add Data Sources
**Source Types:**
- Upload documents (PDF, DOCX, TXT)
- Paste text content or meeting transcripts
- Import Slack channel messages

**Process:**
1. Select source type
2. Upload/paste/import content
3. Sources saved to project
4. Multiple sources can be added

#### 4.2 Extract Requirements
**AI Processing:**
1. User clicks "Extract Requirements" button
2. AI analyzes all data sources
3. Identifies and categorizes requirements:
   - Functional Requirements
   - Non-Functional Requirements
   - Constraints
   - Stakeholders
4. Each requirement linked to its source excerpt
5. Confidence score assigned to each requirement in term of percentage.

**View Results:**
- Requirements list by category
- Source traceability
- Edit or remove extracted requirements

#### 4.3 Generate BRD
**BRD Generation:**
1. User clicks "Generate BRD" button
2. AI creates structured Business Requirements Document
3. Document includes:
   - Executive Summary
   - Project Overview
   - Functional Requirements
   - Non-Functional Requirements
   - Assumptions and Constraints
   - Success Criteria

**View BRD:**
- Structured multi-section document
- Professional formatting
- Version tracked

#### 4.4 Refine BRD (Optional)
**Refinement Options:**
- **Natural Language Commands:**
  - "Add a security section"
  - "Expand the technical requirements"
  - "Include compliance requirements"
- **Manual Editing:**
  - Edit sections directly
  - Add/remove content
- **Version Control:**
  - Multiple versions maintained
  - Track changes over time

#### 4.5 View Traceability
**Traceability Table:**
- Links every requirement back to source
- Shows source excerpt
- Displays confidence score
- Enables requirement validation

### 5. Export & Delivery
**Export Options:**
- **PDF Export:** Professional formatted document
- **Markdown Export:** Plain text format for version control
- **Share:** Collaborate with team members

### 6. Project Management
**Ongoing Actions:**
- Return to Dashboard
- Create additional projects
- Update project status
- Manage data sources
- Regenerate or refine BRDs

---

## Key User Paths

### Path A: New User Creating First BRD
```
Landing → Sign Up → Username Setup → Dashboard → 
Create Project → Add Sources → Extract Requirements → 
Generate BRD → Export PDF
```

### Path B: Returning User Refining Existing BRD
```
Landing → Sign In → Dashboard → Select Project → 
View BRD → Refine with Natural Language → 
Review Changes → Export Updated PDF
```

### Path C: User Importing Slack Data
```
Dashboard → Project Workspace → Add Data Sources → 
Import Slack Channel → Select Channel → Import Messages → 
Extract Requirements → Generate BRD
```

---

# Decision Points

### At Authentication
- New user or returning user?
- Email auth or Google OAuth?

### At Dashboard
- Create new project or open existing?

### At Data Sources
- What type of source to add?
- Single source or multiple sources?

### At Requirements
- Accept AI-extracted requirements as-is?
- Edit or remove any requirements?

### At BRD Generation
- Generate initial BRD or refine existing?
- What refinements to make?

### At Export
- PDF or Markdown format?
- Ready to export or need more refinement?

---

## Notes
- All user data is protected by Row Level Security (RLS)
- Users can only access their own projects and data
- AI processing happens via serverless edge functions
- Background processing ensures responsive UI
- Multiple projects can be managed simultaneously
