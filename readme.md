<div align="center">

# 🚀 OpsCore Backend

**The ultimate SaaS engine for professional business operations.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express%205-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Stripe](https://img.shields.io/badge/Stripe-626CD9?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)

</div>

---

## 📖 Project Overview

**OpsCore** is a high-performance, modular SaaS backend designed for multi-tenant business environments. It provides a centralized platform for businesses to manage their entire lifecycle—from workspace creation and team collaboration to project management, billing, and advanced analytics.

Built with **strict tenant data isolation** at its core, OpsCore ensures that each business’s data remains private and secure within its own workspace environment.

---

## 🛠 Tech Stack

| Technology | Purpose | Why it was chosen? |
| :--- | :--- | :--- |
| **Node.js & Express 5** | Core Engine | Industry-standard for scalable, high-performance web applications. |
| **TypeScript** | Language | Provides strict typing and better developer experience, preventing runtime bugs. |
| **Prisma ORM** | Data Access | Offers type-safe database queries and automated migrations for complex schemas. |
| **PostgreSQL** | Database | Relational database known for its reliability and support for multi-tenant data. |
| **better-auth** | Authentication | Modern, SaaS-ready authentication solution with built-in session management. |
| **Stripe** | Payments | The gold standard for global payment processing and subscription management. |
| **Zod** | Validation | Ensures all incoming data conforms to strict schemas before processing. |
| **Cloudinary** | File Storage | Scalable cloud storage for high-speed delivery of task attachments and media. |
| **PDFKit** | Reports | Professional PDF generation for automated invoice creation. |

---

## 🏗 Project Architecture & Workflow

OpsCore follows a **Modular Layered Architecture**, ensuring high maintainability and scalability.

### Inner Workings:
1.  **Request Layer**: Handled by Express 5, utilizing global middlewares for auth, tenant context, and validation.
2.  **Controller Layer**: Orchestrates the flow, validating inputs using **Zod** and passing sanitized data to services.
3.  **Service Layer**: Contains the core business logic. It interacts with the database through Prisma.
4.  **Data Layer**: Prisma handles PostgreSQL interactions with strict type-safety.

### Multi-Tenant Workflow:
Each request is wrapped in a `workspaceContext` middleware that verifies the user's access to the specific workspace, ensuring data isolation at every level.

---

## 🌐 API Endpoints Documentation

All endpoints are prefixed with `/api/v1`.

### 🔐 Authentication & Account (`/auth`, `/account`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/auth/register` | Register a new user account. |
| POST | `/auth/login` | Authenticate and start a session. |
| GET | `/auth/me` | Get currently logged-in user details. |
| POST | `/auth/logout` | Terminate the current session. |
| POST | `/auth/forgot-password` | Initiate password recovery. |
| POST | `/auth/reset-password` | Complete password recovery with token. |
| POST | `/auth/verify-email` | Verify user email address. |
| GET | `/account/profile` | View detailed user profile info. |
| PATCH | `/account/profile` | Update profile (supports photo upload). |

### 🏢 Workspaces & Members (`/workspaces`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/workspaces` | List all workspaces joined by user. |
| POST | `/workspaces` | Create a new private workspace. |
| GET | `/workspaces/:id` | Get specific workspace details (Contextual). |
| POST | `/workspaces/:id/switch`| Switch active workspace context. |
| GET | `/workspaces/:id/members`| List all members in a workspace. |
| PATCH | `/workspaces/:id/members/:mId`| Update member role (Owner/Admin only). |
| DELETE| `/workspaces/:id/members/:mId`| Remove member from workspace. |

### ✉️ Invitations (`/workspaces/:id/invitations`, `/invitations`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/workspaces/:id/invitations`| List pending invitations for workspace. |
| POST | `/workspaces/:id/invitations`| Invite new members via email. |
| POST | `/invitations/:token/accept`| Accept an invitation via public token. |
| POST | `/invitations/:token/decline`| Decline an invitation via public token. |

### 📋 Projects & Tasks (`/projects`, `/tasks`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/projects` | List all projects in active workspace. |
| POST | `/projects` | Create a new project (Owner/Admin). |
| GET | `/projects/:id/tasks` | Get all tasks belonging to a project. |
| GET | `/tasks` | List/Filter all tasks in workspace. |
| POST | `/tasks` | Create task with priority and status. |
| POST | `/tasks/:id/attachments`| Upload file attachments (Cloudinary). |
| POST | `/tasks/:id/comments` | Add discussion comments to a task. |

### 💳 Billing & Invoices (`/billing`, `/invoices`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/billing/subscription` | Get current workspace plan details. |
| POST | `/billing/checkout-session`| Initiate Stripe checkout for upgrades. |
| POST | `/billing/customer-portal`| Access Stripe billing management portal. |
| GET | `/invoices` | List all generated invoices. |
| GET | `/invoices/:id` | View specific invoice details. |
| POST | `/invoices/:id/send` | Email invoice PDF to client (Nodemailer). |

### 📊 Dashboard & Logs (`/dashboard`, `/activity-logs`, `/analytics`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/dashboard/overview` | High-level metrics for the workspace. |
| GET | `/activity-logs` | Audit trail of all workspace activities. |
| GET | `/analytics/projects` | Progress and velocity analytics. |
| GET | `/analytics/revenue` | Financial trends and projections. |

---

## 📁 Detailed Folder Structure

```text
src/
├── app.ts                  # Application entry & middleware setup
├── server.ts               # Server startup & DB connection
├── app/
│   ├── config/             # Global configs (Env, Subscription Plans)
│   ├── constants/          # Static values (Roles, Task Statuses, etc.)
│   ├── helpers/            # Action-specific utility helpers
│   ├── lib/                # Third-party lib wrappers (Stripe, Prisma, Cloudinary)
│   ├── middlewares/        # Express Middlewares (Auth, Guard, Context)
│   ├── modules/            # Core Domain Modules (Feature-rich)
│   │   ├── activityLog/    # Workspace audit trail logic
│   │   ├── analytics/      # Data aggregation & trends
│   │   ├── billing/        # Stripe & Subscription logic
│   │   ├── dashboard/      # Overview metrics
│   │   ├── project/        # Project management domain
│   │   ├── task/           # Task tracking & collaboration
│   │   └── ...             # (User, Auth, Workspace, etc.)
│   ├── routes/             # Central API routing
│   ├── templates/          # EJS email & UI templates
│   ├── uploads/            # Multer configurations for files
│   └── utils/              # Shared generic utilities (pick, catchAsync)
├── generated/              # Prisma auto-generated clients
└── prisma/                 # Database schema definitions (Modular)
```

---

## ✨ Features

- 🏢 **Multi-Tenancy**: Strict isolation between business workspaces.
- 👥 **Team Management**: Invite members with granular roles (Owner, Admin, Member).
- 📋 **Project & Task Boards**: Full CRUD functionality with real-time status updates.
- 💳 **Subscription Engine**: Integrated with Stripe for automated billing cycles.
- 📄 **Automatic Invoicing**: Generates professional PDF invoices for every payment.
- 🔍 **Activity Logs**: Audit trail for all critical actions within a workspace.
- 📊 **Analytics Dashboard**: Real-time insights into project progress and business health.

---

## 🚀 Installation & Setup

1.  **Clone & Install**:
    ```bash
    pnpm install
    ```
2.  **Environment**: Update `.env` with variables from `.env.example`.
3.  **Database**:
    ```bash
    pnpm migrate
    pnpm generate
    ```
4.  **Launch**:
    ```bash
    pnpm dev
    ```

---

<div align="center">
Built with ❤️ for Modern Businesses
</div>
