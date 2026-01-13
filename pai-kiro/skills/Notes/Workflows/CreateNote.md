# CreateNote Workflow

Create a new note in Anytype with appropriate type and tags.

## Input

- **content**: The note content (required)
- **type_hint**: Optional type override (note, page, project, task, bookmark)
- **tags**: Optional specific tags to apply
- **link_to**: Optional object IDs to link to

## Process

### Step 1: Determine Object Type

```
IF type_hint provided:
  use type_hint
ELSE IF content has URL as primary:
  type = "bookmark"
ELSE IF content has headers/sections:
  type = "page"
ELSE IF content mentions project/planning:
  type = "project"
ELSE IF content has action items/deadlines:
  type = "task"
ELSE:
  type = "note"
```

### Step 2: Extract and Resolve Tags

1. **Get tag property ID** dynamically:

```typescript
const properties = await mcp__anytype__API-list-properties({
  space_id: SPACE_ID
});
const tagProperty = properties.data.find(p => p.key === "tag");
const tagPropertyId = tagProperty.id;
```

2. **Extract keywords** from content that could be tags

3. **List existing tags** from Anytype:

```typescript
const existingTags = await mcp__anytype__API-list-tags({
  space_id: SPACE_ID,
  property_id: tagPropertyId
});
```

4. **Match or create tags**:

```typescript
const tagIds = [];
for (const keyword of extractedKeywords) {
  // Search for existing tag (case-insensitive match)
  const existing = existingTags.data.find(
    t => t.name.toLowerCase() === keyword.toLowerCase()
  );

  if (existing) {
    tagIds.push(existing.id);
  } else {
    // Create new tag
    const newTag = await mcp__anytype__API-create-tag({
      space_id: SPACE_ID,
      property_id: tagPropertyId,
      name: keyword,
      color: selectColorForTag(keyword)
    });
    tagIds.push(newTag.id);
  }
}
```

### Tag Color Selection

| Category | Color |
|----------|-------|
| AI/Tech | `purple` |
| Infra/System | `blue` |
| Automation | `teal` |
| Alert/Warning | `orange` |
| Personal | `lime` |
| Default | `grey` |

### Step 3: Create Object

```typescript
const result = await mcp__anytype__API-create-object({
  space_id: "bafyreid74whx6w7wtobtzexo3xp3qn4o2ydl5cdfwmnnehs75yvkmn4jjy.q0x6wvfnyzem",
  type_key: determined_type,
  name: extract_title(content),
  body: content,
  properties: [
    { key: "tag", multi_select: tag_ids }
  ]
});
```

### Step 4: Link Objects (if specified)

```typescript
if (link_to && link_to.length > 0) {
  await mcp__anytype__API-update-object({
    space_id: "...",
    object_id: result.id,
    properties: [
      { key: "links", objects: link_to }
    ]
  });
}
```

## Output

- Object ID
- Object type used
- Tags applied
- Links created
