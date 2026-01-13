# LinkObjects Workflow

Link related objects together in Anytype.

## Input

- **source_id**: Object ID to add links to (required)
- **target_ids**: Object IDs to link to (required)
- **bidirectional**: Create links in both directions (default: false)

## Process

### Step 1: Get Current Links

```typescript
const sourceObj = await mcp__anytype__API-get-object({
  space_id: "bafyreid74whx6w7wtobtzexo3xp3qn4o2ydl5cdfwmnnehs75yvkmn4jjy.q0x6wvfnyzem",
  object_id: source_id
});

const currentLinks = sourceObj.properties
  .find(p => p.key === "links")?.objects || [];
```

### Step 2: Merge Links

```typescript
const newLinks = [...new Set([...currentLinks, ...target_ids])];
```

### Step 3: Update Source Object

```typescript
await mcp__anytype__API-update-object({
  space_id: "...",
  object_id: source_id,
  properties: [
    { key: "links", objects: newLinks }
  ]
});
```

### Step 4: Bidirectional Links (Optional)

If bidirectional is true, repeat for each target:

```typescript
for (const targetId of target_ids) {
  const targetObj = await mcp__anytype__API-get-object({...});
  const targetLinks = targetObj.properties
    .find(p => p.key === "links")?.objects || [];

  await mcp__anytype__API-update-object({
    space_id: "...",
    object_id: targetId,
    properties: [
      { key: "links", objects: [...targetLinks, source_id] }
    ]
  });
}
```

## Linking Strategies

### By Search
```
User: "Link this to notes about PAI"
→ Search "PAI" in space
→ Present matches for user selection
→ Link selected objects
```

### By Recent
```
User: "Link this to my last note"
→ Get recent objects sorted by last_modified_date
→ Link to most recent
```

### By Collection
```
User: "Add this to the Infrastructure collection"
→ Find collection by name
→ Use API-add-list-objects to add
```

## Output

- Confirmation of links created
- List of linked objects with names
- Backlinks note (Anytype auto-creates backlinks)
