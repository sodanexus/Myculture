# 🎭 Kulturo
> Journal culturel personnel — suivez vos jeux, films et livres.

## Stack
- **Frontend** — HTML / CSS / JavaScript vanilla (SPA)
- **Backend** — Supabase (Auth + PostgreSQL + RLS + Edge Functions)
- **APIs** — TMDb · IGDB (via Edge Function) · OpenLibrary · Groq (IA, via Edge Function)
- **Hébergement** — GitHub Pages

## Fonctionnalités

### Bibliothèque
- Grille avec filtres, tri, recherche
- États visuels par statut (wishlist, en cours, en pause, abandonné) avec label overlay
- Notation demi-étoiles (swipe mobile)
- Coups de cœur avec animation dorée

### Fiche détail enrichie
- Backdrop TMDb en fondu pour films & séries
- Poster flouté en fallback pour jeux & livres
- Informations enrichies : réalisateur, casting, durée, saisons, développeur, éditeur, plateformes, pages, ISBN
- Synopsis tronqué avec "Voir plus" sur mobile
- Descriptions traduites en français via Groq (jeux + livres)

### Découverte IA
- Recommandations personnalisées via Groq (`llama-3.3-70b-versatile`)
- Basées sur coups de cœur + meilleures notes
- Diversité forcée entre types (jeux / films / livres)
- Suggestions de niche, exclut les titres déjà en bibliothèque
- Raisons personnalisées affichées sur chaque carte

### Sécurité
- Clé Groq stockée uniquement dans les secrets Supabase (Edge Function `groq-proxy`)
- Clés IGDB idem via Edge Function `igdb-proxy`
- `config.js` non commité (`.gitignore`)

### Stats & Activité
- Dashboard avec statistiques personnelles
- Fil d'activité partagé entre utilisateurs
- Journal des médias terminés

### UX / Mobile
- PWA installable (iOS / Android)
- Thème dark / light
- Modal détail avec animations
- Navigation bottom bar mobile
