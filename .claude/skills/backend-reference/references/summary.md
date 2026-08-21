This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# Summary

## Purpose

This is a reference codebase organized into multiple files for AI consumption.
It is designed to be easily searchable using grep and other text-based tools.

## File Structure

This skill contains the following reference files:

| File | Contents |
|------|----------|
| `project-structure.md` | Directory tree with line counts per file |
| `files.md` | All file contents (search with `## File: <path>`) |
| `tech-stacks.md` | Languages, frameworks, and dependencies per package (search with `## Tech Stack: <path>`) |
| `summary.md` | This file - purpose and format explanation |

## Usage Guidelines

- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes

- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: backend/app/**, supabase/migrations/**
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

## Statistics

52 files | 6,114 lines

| Language | Files | Lines |
|----------|------:|------:|
| Python | 44 | 5,331 |
| SQL | 8 | 783 |

**Largest files:**
- `supabase/migrations/0001_festify_full_schema.sql` (589 lines)
- `backend/app/routers/theft.py` (416 lines)
- `backend/app/routers/organizer_admin.py` (334 lines)
- `backend/app/routers/platform.py` (313 lines)
- `backend/app/routers/tickets.py` (301 lines)
- `backend/app/routers/orders.py` (291 lines)
- `backend/app/routers/super_auth.py` (277 lines)
- `backend/app/routers/events.py` (251 lines)
- `backend/app/routers/prime_pass.py` (236 lines)
- `backend/app/core/email_client.py` (184 lines)