---
name: Notes
description: Anytype note-taking system. USE WHEN user wants to take notes, record ideas, save information, or organize knowledge. Creates objects in Anytype with appropriate types and tags.
---

# Notes

Manage notes and knowledge using Anytype MCP. Automatically selects the right object type, adds relevant tags, and links related content.

## Anytype Configuration

**Space:** AI Notes

**Space ID:** `bafyreid74whx6w7wtobtzexo3xp3qn4o2ydl5cdfwmnnehs75yvkmn4jjy.q0x6wvfnyzem`

## Object Types

| Type | Key | Use Case |
|------|-----|----------|
| **Note** | `note` | Quick thoughts, fleeting ideas, short memos |
| **Page** | `page` | Structured content, documentation, articles |
| **Project** | `project` | Project-related notes, planning docs |
| **Task** | `task` | Actionable items with due dates |
| **Bookmark** | `bookmark` | Save URLs with context |

## Tag Management

Tags are **dynamically managed** - all IDs are resolved at runtime.

### Tag Resolution Process

1. **Get tag property ID** via `API-list-properties`, find `key: "tag"`
2. **Extract keywords** from note content
3. **List existing tags** via `API-list-tags` with the property ID
4. **Match or create**:
   - If tag exists → use its ID
   - If not exists → `API-create-tag` with appropriate color
5. **Apply tags** to object via `properties: [{ key: "tag", multi_select: [tag_ids] }]`

### Tag Colors
Available colors for new tags: `grey`, `yellow`, `orange`, `red`, `pink`, `purple`, `blue`, `ice`, `teal`, `lime`

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CreateNote** | "note this", "save this", "record" | `Workflows/CreateNote.md` |
| **SearchNotes** | "find notes", "search notes" | `Workflows/SearchNotes.md` |
| **LinkObjects** | "link these", "connect", "relate" | `Workflows/LinkObjects.md` |

## Type Selection Logic

1. **Note** - Default for quick capture, no structure needed
2. **Page** - Content has sections, headers, or is documentation
3. **Project** - Mentions project name or planning
4. **Task** - Has actionable items, deadlines, or todos
5. **Bookmark** - Primary content is a URL

## Tag Selection Logic

Automatically tag based on content keywords:
- Mentions "PAI", "assistant", "AI" → `pai`
- Mentions "automate", "script", "hook" → `zi_dong_hua`
- Mentions "infra", "server", "deploy" → `ji_chu_jia_gou`
- Mentions "monitor", "alert", "log" → `jian_kong`
- Mentions "skill", "capability" → `ji_neng`

## Linking Objects

Use the `links` property to connect related objects:

```typescript
// Link object A to object B
mcp__anytype__API-update-object({
  space_id: "...",
  object_id: "object_a_id",
  properties: [
    { key: "links", objects: ["object_b_id"] }
  ]
})
```

## Examples

**Example 1: Quick note**
```
User: "Note: The MCP server needs ANYTYPE_MCP_HEADERS env var"
→ Create Note type
→ Auto-tag: pai, ji_chu_jia_gou
→ Save to Anytype
```

**Example 2: Structured documentation**
```
User: "Save this as documentation: [long content with headers]"
→ Create Page type
→ Parse content structure
→ Add appropriate tags
```

**Example 3: Link related notes**
```
User: "Link this note to the PAI architecture page"
→ Search for "PAI architecture"
→ Update links property
→ Confirm linkage
```

**Example 4: Save a bookmark**
```
User: "Bookmark this: https://docs.anthropic.com/..."
→ Create Bookmark type
→ Set source URL
→ Add description from context
```
