# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a **BrainTrain** workspace configured for Google Cloud Stitch MCP integration. The workspace is set up to interact with the Stitch API via MCP (Model Context Protocol).

## Environment Configuration

- **Google Cloud Project**: `stich-brain`
- **MCP Server**: `stitch` (HTTP transport to `https://stitch.googleapis.com/mcp`)
- **Auth**: Bearer token-based authentication via `Authorization` header

## Available MCP Tools

The Stitch MCP server is configured in `.mcp.json` with the following headers:
- `Authorization: Bearer <token>`
- `X-Goog-User-Project: stich-brain`

## Development Notes

- Credentials are stored in `.env` (gitignored)
- MCP configuration is in `.mcp.json` (gitignored)
- Personal Claude settings are in `.claude/settings.local.json`

## Common Commands

```bash
# MCP server is managed via Claude Code - no manual start required
# To check MCP server status:
claude mcp list

# To re-add the Stitch MCP server if needed:
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp \
  --header "Authorization: Bearer $STITCH_ACCESS_TOKEN" \
  --header "X-Goog-User-Project: stich-brain" \
  -s user
```
