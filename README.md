# ViBa Mart - Enterprise eCommerce Platform

ViBa Mart is a modern, full-stack eCommerce application built with a focus on speed, security, and a premium user experience.

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Node.js (Express), Firebase (Firestore, Auth)
- **State Management**: Zustand
- **Styling**: Tailwind CSS with Premium Red Theme
- **Database**: Google Cloud Firestore (Enterprise Edition)

## Features
- **Intelligent Search Engine**: Sub-millisecond inverted index (`MiniSearch`), BM25 lexical ranking, SKU exact match boosting, e-commerce synonym expansion, and typo tolerance.
- **AI Semantic Intent Parser**: Natural language shopping queries parsed using Gemini 2.5 Flash with sub-millisecond heuristic fallback.
- **Predictive Autocomplete**: Instant search suggestions for products, brands, and categories.
- **Merchandising & Curation**: Admin product pinning, brand/category boosting, and custom business synonyms.
- **Authentication**: Firebase Google Login & Role-based Access Control.
- **Product Management**: Multi-vendor support with variants and stock control.
- **Ordering**: Full checkout flow with GST calculation and COD/UPI support.
- **Admin Dashboard**: Real-time analytics, inventory monitoring, order management, and search curation.
- **Performance**: In-memory LRU caching, image optimization, lazy loading, and reactive UI updates.

## Installation & Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Configure your Firebase credentials in `firebase-applet-config.json` or `.env`.
4. Run `npm run dev` to start the development server.
5. Use `npm run build` for production builds.

## API Endpoints
- `GET /api/health`: Health check for the backend.
- `GET /api/search`: Intelligent product discovery with filters, facets, and pagination.
- `GET /api/search/suggestions`: Live predictive autocomplete suggestions.
- `POST /api/search/analytics`: Search and product click-through telemetry beacon.
- `POST /api/search/reindex`: Admin catalog re-indexing trigger (Admin token required).
- `GET/POST /api/search/admin/curation`: Merchandising rules management (Admin token required).
- `GET /api/search/admin/analytics`: Search metrics, top queries, and zero-result logs (Admin token required).
- `POST /api/search/ai/intent`: Natural language query intent decomposition.
- `POST /api/payment/verify`: Mock payment verification endpoint.

## Documentation
- Detailed architectural manual and operator runbook: [SEARCH_ENGINE_SPECIFICATION.md](docs/SEARCH_ENGINE_SPECIFICATION.md)

## Security
- **Search Hardening**: Strict XSS stripping, buffer flood truncation (120 chars), and ASCII control character sanitization.
- **Rate Limiting**: Multi-tier rate limiting on search, suggestions, and heavy reindex triggers.
- **Firestore Rules**: Strict RBAC rules preventing unauthorized access.
- **Verification**: All write operations require verified email status.
- **Validation**: Strict schema validation for products and orders.
