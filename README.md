# Assessment Checker

An AI-powered assessment grading system that uses OCR to scan handwritten student work and provides automated grading with detailed feedback.

## Features

### For Teachers
- Create and manage classes with unique class codes
- Create assessments with detailed mark schemes
- Upload student handwritten work for automatic grading
- View all student submissions in a split-screen view
- Track student progress and grades

### For Students
- Join classes using class codes
- Submit handwritten work as images
- View grades and AI-generated feedback in split-screen mode
- Access mark schemes for reference
- Track assessment progress

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Authentication**: NextAuth.js
- **Database**: SQLite (via Prisma)
- **OCR**: Tesseract.js
- **AI Grading**: OpenAI GPT-4o-mini

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd assessment-checker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=your-openai-api-key
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Creating a Teacher Account
1. Go to the registration page
2. Select "Teacher" as your role
3. Fill in your details and create an account

### Creating a Class (Teachers)
1. Log in to your teacher account
2. Click "Create Class" on the dashboard
3. Enter class details
4. Share the generated class code with students

### Joining a Class (Students)
1. Log in to your student account
2. Click "Join Class"
3. Enter the class code from your teacher

### Creating an Assessment (Teachers)
1. Go to a class page
2. Click "New Assessment"
3. Enter assessment details and a detailed mark scheme
4. The mark scheme is used by AI to grade submissions

### Submitting Work (Students)
1. Go to an assessment
2. Click "Submit Work"
3. Upload a clear photo of your handwritten work
4. Wait for AI processing (usually a few seconds)

### Viewing Results
- Students: Click "View Detailed Feedback" to see a split-screen view
- Teachers: Click on any submission to see the student's work and AI feedback

## Mark Scheme Guidelines

For best AI grading results, structure your mark scheme clearly:

```
Question 1 (10 marks):
- Correct formula: 2 marks
- Correct substitution: 3 marks
- Correct calculation: 3 marks
- Correct units: 2 marks

Question 2 (15 marks):
- Definition: 5 marks
- Explanation: 5 marks
- Examples: 5 marks
```

## Project Structure

```
├── app/
│   ├── (auth)/              # Auth pages (login, register)
│   ├── (dashboard)/         # Dashboard pages
│   │   ├── assessments/     # Assessment pages
│   │   ├── classes/         # Class management
│   │   ├── dashboard/       # Main dashboard
│   │   ├── profile/         # User profile
│   │   └── settings/        # Settings page
│   └── api/                 # API routes
├── components/
│   ├── dashboard/           # Dashboard components
│   └── ui/                  # UI components
├── lib/
│   ├── services/           # OCR and grading services
│   ├── auth.ts             # NextAuth configuration
│   ├── prisma.ts           # Prisma client
│   └── utils.ts            # Utility functions
├── prisma/
│   └── schema.prisma       # Database schema
└── public/
    └── uploads/            # Uploaded images
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret key | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI grading | No (uses mock grading if not set) |

## Notes

- Without an OpenAI API key, the system will use mock grading
- For best OCR results, ensure submitted images are clear and well-lit
- The database uses SQLite by default; you can change to PostgreSQL for production

## License

MIT
