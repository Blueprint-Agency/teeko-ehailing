# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This repo contains the Product Requirements Document (PRD) for **Teeko**, a Malaysian e-hailing app. It is a documentation-only repo — there is no application code here.

## Key File

- `teeko-prd.md` — The single source of truth for product requirements, features, tech stack, compliance, and scope.

## GitHub

- Remote repo: https://github.com/Blueprint-Agency/teeko-ehailing
- GitHub token is stored in `.env` (never commit this file — it is already in `.gitignore`)

## PRD Context

- **Product:** Teeko — a lower-cost e-hailing app competing with Grab, Bolt, inDriver in Malaysia
- **Target:** APAD/JPJ e-hailing operator licence application support
- **MVP Timeline:** 1 month (aggressive — ruthless prioritisation required)
- **Tech Stack:** React Native (mobile), Node.js (backend), PostgreSQL + Redis, Google Maps, Stripe + TNG/GrabPay, Firebase Auth, AWS/GCP (Malaysia region preferred)
- **Compliance:** APAD/JPJ Land Public Transport Act 2010, PDPA 2010, trip insurance requirement

## Working with This Repo

When editing the PRD, preserve the existing Markdown structure (numbered sections, tables, code blocks). Substantive changes to scope, compliance requirements, or the tech stack should be discussed before editing.
