---
name: Notes
description: Anytype note-taking system. USE WHEN user wants to take notes, record ideas, save information, or organize knowledge. Creates objects in Anytype with appropriate types and tags.
---

# Notes

Manage notes and knowledge using Anytype MCP. Automatically selects the right object type, adds relevant tags, and links related content.

## MCP Tools Used

| Tool | Purpose |
|------|---------|
| `mcp__anytype__API-list-spaces` | Get available spaces |
| `mcp__anytype__API-list-types` | Get object types in a space |
| `mcp__anytype__API-list-properties` | Get properties (including tag property) |
| `mcp__anytype__API-list-tags` | Get existing tags |
| `mcp__anytype__API-create-tag` | Create new tag |
| `mcp__anytype__API-create-object` | Create note/page/task/etc |
| `mcp__anytype__API-update-object` | Update object (add links, tags) |
| `mcp__anytype__API-search-space` | Search objects in a space |

## Space Configuration

**Default Space:** AI Notes

Get space ID dynamically:
```
spaces = mcp__anytype__API-list-spaces()
space = spaces.data.find(s => s.name === "AI Notes")
SPACE_ID = space.id
```

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

1. **Get tag property ID**:
```
properties = mcp__anytype__API-list-properties({ space_id: SPACE_ID })
tagProperty = properties.data.find(p => p.key === "tag")
TAG_PROPERTY_ID = tagProperty.id
```

2. **List existing tags**:
```
existingTags = mcp__anytype__API-list-tags({
  space_id: SPACE_ID,
  property_id: TAG_PROPERTY_ID
})
```

3. **Match or create**:
   - If tag exists → use its ID
   - If not exists → create with `mcp__anytype__API-create-tag`

4. **Apply tags** to object:
```
properties: [{ key: "tag", multi_select: [tag_id_1, tag_id_2] }]
```

### Tag Colors
Available: `grey`, `yellow`, `orange`, `red`, `pink`, `purple`, `blue`, `ice`, `teal`, `lime`

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

## Linking Objects

Use the `links` property to connect related objects:

```
mcp__anytype__API-update-object({
  space_id: SPACE_ID,
  object_id: "source_object_id",
  properties: [
    { key: "links", objects: ["target_object_id"] }
  ]
})
```

## Examples

**Example 1: Quick note**
```
User: "Note: The MCP server needs ANYTYPE_MCP_HEADERS env var"

1. Get space ID from API-list-spaces
2. Get tag property ID from API-list-properties
3. Search existing tags, create "PAI" and "Infrastructure" if needed
4. Create object:
   mcp__anytype__API-create-object({
     space_id: SPACE_ID,
     type_key: "note",
     name: "MCP server env var requirement",
     body: "The MCP server needs ANYTYPE_MCP_HEADERS env var",
     properties: [{ key: "tag", multi_select: [pai_tag_id, infra_tag_id] }]
   })
```

**Example 2: Save a bookmark**
```
User: "Bookmark this: https://docs.anthropic.com/..."

mcp__anytype__API-create-object({
  space_id: SPACE_ID,
  type_key: "bookmark",
  name: "Anthropic Documentation",
  properties: [
    { key: "source", url: "https://docs.anthropic.com/..." }
  ]
})
```

**Example 3: Link related notes**
```
User: "Link this note to the PAI architecture page"

1. Search for "PAI architecture":
   results = mcp__anytype__API-search-space({
     space_id: SPACE_ID,
     query: "PAI architecture"
   })

2. Update links:
   mcp__anytype__API-update-object({
     space_id: SPACE_ID,
     object_id: current_note_id,
     properties: [{ key: "links", objects: [results.data[0].id] }]
   })
```
