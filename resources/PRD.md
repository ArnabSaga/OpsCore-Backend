# OpsCore ⚙️
**"The Multi-Tenant SaaS Business Management Platform"**

---

# Product Requirements Document (PRD)

---

# Project Overview

OpsCore is a multi-tenant SaaS platform designed to help businesses manage their **operations, users, products, orders, analytics, and automation** from a single centralized system.

Each company that signs up becomes a **Tenant (Workspace)** with isolated data and its own team members.

OpsCore enables businesses to:

- Manage employees and roles
- Handle products and inventory
- Track customers and orders
- Generate invoices
- Monitor analytics dashboards
- Automate workflows

The system is built using a **secure multi-tenant architecture**, ensuring **complete data isolation between companies**.

---

# Core Concepts

| Concept | Description |
|--------|-------------|
| Tenant | A company or organization using the platform |
| Workspace | The isolated environment belonging to a tenant |
| User | A person working inside a tenant workspace |
| Role | Defines user permissions |
| Permission | Specific actions users can perform |

---

# Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| Super Admin | Platform owner | Manage tenants, global settings |
| Tenant Admin | Business owner | Manage users, roles, settings |
| Manager | Operational manager | Manage products, orders, reports |
| Staff | Employees | Perform assigned operational tasks |

> **Note:** Each tenant manages their own users, roles, and permissions.

---

# Tech Stack

## Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL

## Frontend
- Next.js
- Tailwind CSS
- ShadCN UI

## Authentication
- JWT Authentication
- Role Based Access Control (RBAC)

## Infrastructure
- Docker
- Redis (optional caching)
- Cloud Storage

---

# Features

## Public Features

- Landing page
- Platform overview
- Pricing
- Business registration
- Login / Authentication

---

## Tenant Features

### Workspace Management

- Create workspace
- Manage company profile
- Configure business settings

### User Management

- Invite employees
- Assign roles
- Manage permissions
- Suspend or remove users

### Product Management

- Create products/services
- Organize categories
- Track inventory
- Update product details

### Customer Management

- Store customer data
- Track purchase history
- Manage customer relationships

### Order Management

- Create orders
- Track order lifecycle
- Update order status
- Manage order fulfillment

### Invoice Management

- Generate invoices
- Track payments
- Manage billing records

### Notifications

- System alerts
- Order updates
- User activity notifications

### Automation

- Trigger actions
- Schedule workflows
- Automate repetitive operations

### Audit Logs

- Track user activities
- Security monitoring
- System transparency

### Dashboard & Analytics

- Sales analytics
- Order statistics
- Business performance metrics
- Real-time insights

---

# Pages & Routes

These routes are examples and may be extended.

---

## Public Routes

| Route | Page | Description |
|------|------|-------------|
| `/` | Landing Page | Platform overview |
| `/pricing` | Pricing | Subscription plans |
| `/login` | Login | User authentication |
| `/register` | Register | Create tenant workspace |

---

## Tenant Routes (Private)

| Route | Page | Description |
|------|------|-------------|
| `/dashboard` | Dashboard | Analytics & summary |
| `/users` | User Management | Manage employees |
| `/roles` | Roles | Manage role permissions |
| `/products` | Products | Manage product catalog |
| `/categories` | Categories | Product categories |
| `/customers` | Customers | Customer management |
| `/orders` | Orders | Track and manage orders |
| `/invoices` | Invoices | Billing and payments |
| `/notifications` | Notifications | Alerts & updates |
| `/automation` | Automation | Workflow automation |
| `/audit-logs` | Audit Logs | System activity tracking |

---

## Super Admin Routes

| Route | Page | Description |
|------|------|-------------|
| `/admin` | Admin Dashboard | Global analytics |
| `/admin/tenants` | Tenants | Manage all companies |
| `/admin/users` | Users | Platform user management |
| `/admin/settings` | Settings | System configuration |

---

# Database Tables

### Tenants

| Field | Type |
|------|------|
| id | UUID |
| name | String |
| slug | String |
| createdAt | Date |
| updatedAt | Date |

---

### Users

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| name | String |
| email | String |
| password | String |
| roleId | UUID |
| status | Enum |
| createdAt | Date |

---

### Roles

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| name | String |

---

### Permissions

| Field | Type |
|------|------|
| id | UUID |
| name | String |

---

### Products

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| name | String |
| price | Number |
| stock | Number |
| categoryId | UUID |

---

### Categories

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| name | String |

---

### Customers

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| name | String |
| email | String |

---

### Orders

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| customerId | UUID |
| status | Enum |
| totalAmount | Number |

---

### OrderItems

| Field | Type |
|------|------|
| id | UUID |
| orderId | UUID |
| productId | UUID |
| quantity | Number |

---

### Invoices

| Field | Type |
|------|------|
| id | UUID |
| tenantId | UUID |
| orderId | UUID |
| amount | Number |
| status | Enum |

---

### Notifications

| Field | Type |
|------|------|
| id | UUID |
| userId | UUID |
| message | String |
| read | Boolean |

---

### AuditLogs

| Field | Type |
|------|------|
| id | UUID |
| userId | UUID |
| action | String |
| timestamp | Date |

---

# API Endpoints

## Authentication

| Method | Endpoint | Description |
|------|------|-------------|
| POST | `/api/auth/register` | Register tenant |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get logged user |

---

## Tenant

| Method | Endpoint | Description |
|------|------|-------------|
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/:id` | Get tenant details |

---

## Users

| Method | Endpoint | Description |
|------|------|-------------|
| GET | `/api/users` | Get tenant users |
| POST | `/api/users` | Create user |
| PATCH | `/api/users/:id` | Update user |

---

## Products

| Method | Endpoint | Description |
|------|------|-------------|
| GET | `/api/products` | Get products |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

---

## Orders

| Method | Endpoint | Description |
|------|------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | Get orders |
| PATCH | `/api/orders/:id` | Update order status |

---

## Customers

| Method | Endpoint | Description |
|------|------|-------------|
| GET | `/api/customers` | Get customers |
| POST | `/api/customers` | Create customer |

---

# Flow Diagrams

## Tenant Onboarding

```
Register → Create Tenant → Invite Users → Start Managing Business
```

---

## Order Workflow

```
Create Order → Pending → Processing → Completed
```

---

# Multi-Tenant Data Isolation

Each database record contains:


tenantId


Every query must filter by:


WHERE tenantId = currentTenant


This ensures **complete tenant data isolation**.

---

# Security Considerations

- JWT Authentication
- Role Based Access Control
- Tenant data isolation
- API rate limiting
- Audit logging
- Input validation

---

# Future Enhancements

- AI analytics
- Payment gateway integration
- Mobile application
- Plugin ecosystem
- Advanced automation
- Multi-language support

---

# Conclusion

OpsCore is designed as a **scalable enterprise SaaS platform** that helps businesses manage operations efficiently within a secure multi-tenant environment.

The architecture prioritizes:

- Scalability
- Security
- Modularity
- Automation
