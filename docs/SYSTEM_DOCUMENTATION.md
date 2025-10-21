# ТУУШИН ХХК Freight CRM System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Entity Relationship Diagrams](#entity-relationship-diagrams)
5. [System Architecture](#system-architecture)
6. [API Documentation](#api-documentation)
7. [Authentication & Authorization](#authentication--authorization)
8. [Business Workflows](#business-workflows)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Component Architecture](#component-architecture)

## System Overview

ТУУШИН ХХК Freight CRM is a comprehensive freight management system designed for Mongolian logistics company ТУУШИН ХХК. The system manages the complete freight lifecycle from inquiry to shipment delivery, including quotation management, customer relationships, and business analytics.

### Core Features

- **Customer Management**: Comprehensive customer database with communication tracking
- **Quotation System**: Full-featured quotation creation, editing, and PDF generation
- **Inquiry Management**: Structured inquiry workflow with rate management
- **Shipment Tracking**: Real-time shipment status and tracking events
- **Master Data Sync**: External system integration for reference data
- **Audit Logging**: Complete system activity tracking
- **Multi-language Support**: English and Mongolian language support
- **Role-based Access Control**: Granular permissions system

## Technology Stack

### Backend

- **Framework**: Next.js 15.4.2 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with JWT strategy
- **Validation**: Zod schema validation
- **API**: RESTful API with Next.js Route Handlers

### Frontend

- **Framework**: React 19.1.0 with TypeScript
- **Styling**: Tailwind CSS 4.0 with shadcn/ui components
- **State Management**: Zustand for client state, TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Data Tables**: TanStack Table with advanced filtering
- **Icons**: Lucide React
- **Animations**: Framer Motion

### DevOps & Tools

- **Package Manager**: pnpm
- **Linting**: ESLint with Prettier
- **Type Checking**: TypeScript 5
- **Database Migrations**: Prisma migrations
- **Docker**: Containerized deployment
- **Git Hooks**: Husky with lint-staged

## Database Schema

### Core Entities

The database is organized into several main domains:

1. **User Management & Authentication**
2. **Location & Reference Data**
3. **Customer Management**
4. **Quotation Management**
5. **Inquiry & Quotation System**
6. **Shipment Management**
7. **External System Integration**
8. **System Configuration**
9. **Audit & Logging**

## Entity Relationship Diagrams

### Main System Entities

```mermaid
erDiagram
    User ||--o{ Account : "has"
    User ||--o{ Session : "has"
    User ||--o{ Quotation : "creates"
    User ||--o{ Inquiry : "creates"
    User ||--o{ Shipment : "creates"
    User ||--o{ Customer : "creates"
    User ||--o{ AuditLog : "generates"

    Customer ||--o{ Quotation : "requests"
    Customer ||--o{ Inquiry : "submits"
    Customer ||--o{ Shipment : "receives"
    Customer ||--o{ CustomerCommunication : "participates"

    Quotation ||--o| Inquiry : "based_on"
    Quotation ||--o{ Shipment : "converts_to"
    Quotation }o--|| Customer : "for"
    Quotation }o--|| Currency : "in"

    Inquiry ||--o{ InquirySize : "has"
    Inquiry ||--o{ InquiryRate : "has"
    Inquiry ||--o{ InquiryExtra : "has"
    Inquiry ||--o{ InquiryOffer : "generates"
    Inquiry ||--o{ InquiryCommunication : "has"
    Inquiry ||--o{ InquiryAttachment : "has"

    Shipment ||--o{ ShipmentTracking : "tracked_by"

    Country ||--o{ City : "contains"
    Country ||--o{ Port : "has"
    City ||--o{ Port : "contains"
    City ||--o{ Customer : "located_in"

    MasterOption ||--o{ Quotation : "references"
    MasterOption ||--o{ Inquiry : "references"

    User {
        string id PK
        string name
        string email UK
        string password
        enum role
        datetime emailVerified
        string image
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Customer {
        string id PK
        string companyName
        string contactPerson
        string email
        string phone
        string address
        string countryId FK
        string cityId FK
        enum customerType
        enum status
        enum languagePreference
        string createdBy FK
        string updatedBy FK
        datetime createdAt
        datetime updatedAt
    }

    Quotation {
        string id PK
        string referenceNumber UK
        string customerId FK
        string userId FK
        string updatedBy FK
        string assignedTo FK
        string inquiryId FK
        enum cargoType
        string cargoDescription
        float weight
        enum weightUnit
        float volume
        enum volumeUnit
        int packageCount
        string packageType
        string originPortId FK
        string destinationPortId FK
        string pickupAddress
        string deliveryAddress
        string incoterm
        string currencyId FK
        float exchangeRate
        float totalAmount
        float profitMargin
        enum status
        enum language
        datetime validUntil
        datetime sentAt
        datetime confirmedAt
        datetime createdAt
        datetime updatedAt
    }

    Inquiry {
        string id PK
        string code UK
        string name
        string customerId FK
        string customerContactPerson
        string commodityType
        string cargoDescription
        boolean isDangerous
        boolean requiresPermits
        enum transportMode
        string transportType
        enum incoterm
        string incotermLocation
        string originCountry
        string originCity
        string originAddress
        string destinationCountry
        string destinationCity
        string destinationAddress
        string viaRoute
        string borderCrossing
        datetime validityDate
        datetime quotationDate
        datetime expectedShipDate
        string included
        string excluded
        string specialNotes
        string salesPersonId FK
        string operatorId FK
        string customsAgentId FK
        enum status
        enum priority
        boolean isArchived
        datetime submittedAt
        datetime quotedAt
        datetime approvedAt
        datetime convertedAt
        datetime closedAt
        string createdById FK
        string updatedById FK
        datetime createdAt
        datetime updatedAt
    }

    Shipment {
        string id PK
        string referenceNumber UK
        string quotationId FK
        string customerId FK
        string userId FK
        string assignedTo FK
        enum status
        string currentLocation
        datetime estimatedDeparture
        datetime actualDeparture
        datetime estimatedArrival
        datetime actualArrival
        string blNumber
        string[] containerNumbers
        string vesselVoyage
        datetime createdAt
        datetime updatedAt
    }

    MasterOption {
        string id PK
        enum category
        string name
        string externalId UK
        enum source
        string code
        json meta
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    AuditLog {
        string id PK
        datetime createdAt
        string userId FK
        string userEmail
        string action
        string resource
        string resourceId
        string ip
        string userAgent
        json metadata
    }
```

### Inquiry System Detail

```mermaid
erDiagram
    Inquiry ||--o{ InquirySize : "has_dimensions"
    Inquiry ||--o{ InquiryRate : "has_rates"
    Inquiry ||--o{ InquiryExtra : "has_extras"
    Inquiry ||--o{ InquiryOffer : "generates_offers"
    Inquiry ||--o{ InquiryCommunication : "has_communications"
    Inquiry ||--o{ InquiryAttachment : "has_attachments"

    InquirySize {
        string id PK
        string inquiryId FK
        string containerType
        int quantity
        decimal length
        decimal width
        decimal height
        decimal weight
        decimal volume
        string unit
        datetime createdAt
        datetime updatedAt
    }

    InquiryRate {
        string id PK
        string inquiryId FK
        enum rateType
        string carrierId
        string carrierName
        string routeId
        string currency
        decimal freightRate
        decimal fuelSurcharge
        decimal securityFee
        decimal handlingFee
        decimal documentFee
        decimal insuranceFee
        decimal customsFee
        decimal terminalFee
        decimal otherFees
        decimal totalCost
        int transitTime
        datetime validFrom
        datetime validTo
        string notes
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    InquiryExtra {
        string id PK
        string inquiryId FK
        string serviceType
        string serviceName
        string description
        string providerId
        string providerName
        string currency
        decimal unitPrice
        int quantity
        decimal totalCost
        boolean isRequired
        boolean isIncluded
        datetime createdAt
        datetime updatedAt
    }

    InquiryOffer {
        string id PK
        string inquiryId FK
        string offerNumber UK
        int version
        string currency
        decimal freightCost
        decimal extraCosts
        decimal markup
        decimal discount
        decimal totalSellingPrice
        decimal totalCostPrice
        decimal grossProfit
        decimal profitMargin
        string paymentTerms
        int validityPeriod
        string remarks
        enum status
        boolean isActive
        datetime sentAt
        datetime approvedAt
        datetime rejectedAt
        datetime createdAt
        datetime updatedAt
    }
```

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile Browser]
    end

    subgraph "Application Layer"
        NEXT[Next.js App Router]
        API[API Routes]
        AUTH[NextAuth.js]
        MIDDLEWARE[Middleware]
    end

    subgraph "Business Logic Layer"
        SERVICES[Business Services]
        VALIDATION[Zod Validation]
        AUDIT[Audit Logging]
        SYNC[External Sync]
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
    end

    subgraph "External Systems"
        CRM[External CRM]
        MASTER[Master Data APIs]
    end

    WEB --> NEXT
    MOBILE --> NEXT
    NEXT --> API
    NEXT --> AUTH
    NEXT --> MIDDLEWARE
    API --> SERVICES
    SERVICES --> VALIDATION
    SERVICES --> AUDIT
    SERVICES --> SYNC
    SERVICES --> PRISMA
    PRISMA --> POSTGRES
    SYNC --> CRM
    SYNC --> MASTER
    AUTH --> REDIS
```

### Component Architecture

```mermaid
graph TB
    subgraph "Pages"
        DASHBOARD[Dashboard]
        QUOTATIONS[Quotations]
        INQUIRIES[Inquiries]
        CUSTOMERS[Customers]
        REPORTS[Reports]
        MASTER[Master Data]
    end

    subgraph "Components"
        UI[UI Components]
        FORMS[Form Components]
        TABLES[Data Tables]
        CHARTS[Charts]
        LAYOUT[Layout Components]
    end

    subgraph "Hooks"
        LOOKUP[useLookup]
        RULES[useRuleCatalog]
        FORMS_HOOK[useForm]
        QUERY[TanStack Query]
    end

    subgraph "Services"
        API_CLIENT[API Client]
        VALIDATION[Validation]
        I18N[Internationalization]
        THEME[Theme Management]
    end

    DASHBOARD --> UI
    QUOTATIONS --> FORMS
    INQUIRIES --> TABLES
    CUSTOMERS --> LAYOUT
    REPORTS --> CHARTS
    MASTER --> UI

    UI --> LOOKUP
    FORMS --> RULES
    TABLES --> QUERY
    CHARTS --> API_CLIENT
    LAYOUT --> I18N

    LOOKUP --> API_CLIENT
    RULES --> VALIDATION
    QUERY --> API_CLIENT
    API_CLIENT --> VALIDATION
```

## API Documentation

### Authentication Endpoints

| Method | Endpoint             | Description         | Auth Required |
| ------ | -------------------- | ------------------- | ------------- |
| POST   | `/api/auth/register` | User registration   | No            |
| POST   | `/api/auth/signin`   | User login          | No            |
| POST   | `/api/auth/signout`  | User logout         | Yes           |
| GET    | `/api/auth/session`  | Get current session | Yes           |

### Quotation Endpoints

| Method | Endpoint               | Description                     | Auth Required |
| ------ | ---------------------- | ------------------------------- | ------------- |
| GET    | `/api/quotations`      | List quotations with pagination | Yes           |
| POST   | `/api/quotations`      | Create new quotation            | Yes           |
| GET    | `/api/quotations/[id]` | Get quotation details           | Yes           |
| PUT    | `/api/quotations/[id]` | Update quotation                | Yes           |
| DELETE | `/api/quotations/[id]` | Delete quotation                | Yes           |

### Customer Endpoints

| Method | Endpoint              | Description          | Auth Required |
| ------ | --------------------- | -------------------- | ------------- |
| GET    | `/api/customers`      | List customers       | Yes           |
| POST   | `/api/customers`      | Create customer      | Yes           |
| GET    | `/api/customers/[id]` | Get customer details | Yes           |
| PUT    | `/api/customers/[id]` | Update customer      | Yes           |

### Master Data Endpoints

| Method | Endpoint             | Description                 | Auth Required |
| ------ | -------------------- | --------------------------- | ------------- |
| GET    | `/api/master`        | List master options         | Yes           |
| POST   | `/api/master`        | Create master option        | Yes           |
| GET    | `/api/lookup/[slug]` | Get lookup data by category | Yes           |
| POST   | `/api/master/sync`   | Sync external master data   | Yes           |

### Utility Endpoints

| Method | Endpoint         | Description           | Auth Required |
| ------ | ---------------- | --------------------- | ------------- |
| GET    | `/api/health/db` | Database health check | No            |
| GET    | `/api/audit`     | Get audit logs        | Yes           |

## Authentication & Authorization

### User Roles

```mermaid
graph TD
    SUPER_ADMIN[SUPER_ADMIN]
    ADMIN[ADMIN]
    MANAGER[MANAGER]
    USER[USER]
    SALES[SALES]

    SUPER_ADMIN --> ADMIN
    ADMIN --> MANAGER
    MANAGER --> USER
    MANAGER --> SALES

    SUPER_ADMIN -.-> "Full System Access"
    ADMIN -.-> "User Management + All Features"
    MANAGER -.-> "Team Management + Quotations"
    USER -.-> "Basic Operations"
    SALES -.-> "Sales Activities Only"
```

### Permission Matrix

| Feature         | SUPER_ADMIN | ADMIN | MANAGER | USER | SALES |
| --------------- | ----------- | ----- | ------- | ---- | ----- |
| Dashboard       | ✅          | ✅    | ✅      | ✅   | ✅    |
| Quotations      | ✅          | ✅    | ✅      | ✅   | ✅    |
| Inquiries       | ✅          | ✅    | ✅      | ✅   | ✅    |
| Customers       | ✅          | ✅    | ✅      | ✅   | ✅    |
| Reports         | ✅          | ✅    | ✅      | ✅   | ❌    |
| Master Data     | ✅          | ✅    | ✅      | ❌   | ❌    |
| User Management | ✅          | ✅    | ❌      | ❌   | ❌    |
| System Settings | ✅          | ❌    | ❌      | ❌   | ❌    |

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant A as NextAuth
    participant D as Database
    participant API as API Routes

    U->>C: Enter credentials
    C->>A: POST /api/auth/signin
    A->>D: Validate credentials
    D-->>A: User data
    A->>A: Generate JWT
    A-->>C: Session cookie
    C->>API: Request with session
    API->>A: Validate session
    A-->>API: User context
    API-->>C: Response
```

## Business Workflows

### Quotation Workflow

```mermaid
stateDiagram-v2
    [*] --> Draft: Create Quotation
    Draft --> Sent: Send to Customer
    Sent --> Confirmed: Customer Confirms
    Sent --> Expired: Validity Period Ends
    Sent --> Draft: Edit Quotation
    Confirmed --> [*]: Convert to Shipment
    Expired --> [*]: Archive
    Draft --> [*]: Cancel
```

### Inquiry to Quotation Flow

```mermaid
flowchart TD
    INQUIRY[Customer Inquiry] --> REVIEW[Review Inquiry]
    REVIEW --> QUOTE[Create Quotation]
    QUOTE --> APPROVE[Manager Approval]
    APPROVE --> SEND[Send to Customer]
    SEND --> CONFIRM{Customer Confirms?}
    CONFIRM -->|Yes| CONVERT[Convert to Shipment]
    CONFIRM -->|No| FOLLOWUP[Follow Up]
    FOLLOWUP --> SEND
    CONVERT --> TRACK[Track Shipment]
    TRACK --> DELIVER[Delivery]
```

### Master Data Sync Flow

```mermaid
sequenceDiagram
    participant S as System
    participant API as Sync API
    participant DB as Database
    participant E as External System

    S->>API: Trigger sync
    API->>E: Fetch master data
    E-->>API: Return data
    API->>DB: Upsert master options
    DB-->>API: Confirm update
    API->>S: Sync complete
```

## Data Flow Diagrams

### Quotation Creation Flow

```mermaid
flowchart LR
    USER[User] --> FORM[Quotation Form]
    FORM --> VALIDATE[Validation]
    VALIDATE --> API[API Route]
    API --> DB[(Database)]
    API --> AUDIT[Audit Log]
    DB --> RESPONSE[Response]
    RESPONSE --> USER
```

### Print Generation Flow

```mermaid
flowchart LR
    USER[User] --> PRINT[Print Button]
    PRINT --> PAGE[Print Page]
    PAGE --> FETCH[Fetch Quotation Data]
    FETCH --> API[API Call]
    API --> DB[(Database)]
    DB --> DATA[Quotation Data]
    DATA --> RENDER[Render A4 Template]
    RENDER --> PDF[Generate PDF]
    PDF --> USER
```

## Component Architecture

### UI Component Hierarchy

```
App Layout
├── Dashboard Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── Navigation
│   │   ├── User Menu
│   │   └── Language Switcher
│   ├── Sidebar
│   │   └── Navigation Menu
│   └── Main Content
│       ├── Page Header
│       └── Page Content
└── Print Layout
    └── Print Content
```

### Form Components

```
Form Components
├── Input Fields
│   ├── Text Input
│   ├── Select Dropdown
│   ├── Date Picker
│   └── File Upload
├── Complex Fields
│   ├── ComboBox (Searchable)
│   ├── Multi-Select
│   └── Rich Text Editor
└── Form Layout
    ├── Field Groups
    ├── Validation Messages
    └── Submit Actions
```

### Data Table Components

```
Data Table
├── Table Header
│   ├── Column Headers
│   ├── Sort Controls
│   └── Filter Controls
├── Table Body
│   ├── Data Rows
│   ├── Pagination
│   └── Loading States
└── Table Actions
    ├── Row Actions
    ├── Bulk Actions
    └── Export Options
```

## Development Guidelines

### Code Organization

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── (dashboard)/       # Dashboard route group
│   ├── (print)/           # Print route group
│   └── api/               # API routes
├── components/            # Reusable components
│   ├── ui/                # Base UI components
│   ├── forms/             # Form components
│   ├── tables/            # Data table components
│   └── layout/            # Layout components
├── lib/                   # Utility libraries
│   ├── auth.ts            # Authentication
│   ├── db.ts              # Database connection
│   ├── validations.ts     # Zod schemas
│   └── utils.ts           # Helper functions
└── types/                 # TypeScript types
```

### Database Best Practices

1. **Use proper indexing** on frequently queried fields
2. **Implement soft deletes** for important data
3. **Use transactions** for multi-table operations
4. **Audit all changes** through the audit log system
5. **Validate data** at both API and database levels

### API Design Principles

1. **RESTful endpoints** with consistent naming
2. **Comprehensive error handling** with proper HTTP status codes
3. **Input validation** using Zod schemas
4. **Rate limiting** for public endpoints
5. **Audit logging** for all operations

### Security Considerations

1. **Authentication** via NextAuth.js with JWT
2. **Authorization** through role-based permissions
3. **Input sanitization** and validation
4. **SQL injection prevention** via Prisma ORM
5. **Audit trails** for compliance

---

## Conclusion

This documentation provides a comprehensive overview of the ТУУШИН ХХК Freight CRM system. The system is designed with scalability, maintainability, and user experience in mind, using modern web technologies and best practices.

For technical support or questions about the system architecture, please refer to the development team or consult the inline code documentation.
