# CreateNote Workflow

Create a new note in Anytype with appropriate type and tags.

## Input

- **content**: The note content (required)
- **type_hint**: Optional type override (note, page, project, task, bookmark)
- **tags**: Optional specific tags to apply
- **link_to**: Optional object IDs to link to

## Process

### Step 1: Get Space ID

```
spaces = mcp__anytype__API-list-spaces()
space = spaces.data.find(s => s.name === "AI Notes")
SPACE_ID = space.id
```

### Step 2: Determine Object Type

```
IF type_hint provided:
  TYPE_KEY = type_hint
ELSE IF content has URL as primary:
  TYPE_KEY = "bookmark"
ELSE IF content has headers/sections:
  TYPE_KEY = "page"
ELSE IF content mentions project/planning:
  TYPE_KEY = "project"
ELSE IF content has action items/deadlines:
  TYPE_KEY = "task"
ELSE:
  TYPE_KEY = "note"
```

### Step 3: Resolve Tags

1. **Get tag property ID**:
```
properties = mcp__anytype__API-list-properties({ space_id: SPACE_ID })
tagProperty = properties.data.find(p => p.key === "tag")
TAG_PROPERTY_ID = tagProperty.id
```

2. **Extract keywords** from content that could be tags

3. **List existing tags**:
```
existingTags = mcp__anytype__API-list-tags({
  space_id: SPACE_ID,
  property_id: TAG_PROPERTY_ID
})
```

4. **Match or create tags**:
```
tagIds = []
for keyword in extractedKeywords:
  existing = existingTags.data.find(t => t.name.toLowerCase() === keyword.toLowerCase())

  if existing:
    tagIds.push(existing.id)
  else:
    newTag = mcp__anytype__API-create-tag({
      space_id: SPACE_ID,
      property_id: TAG_PROPERTY_ID,
      name: keyword,
      color: selectColor(keyword)
    })
    tagIds.push(newTag.id)
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

### Step 4: Create Object

```
result = mcp__anytype__API-create-object({
  space_id: SPACE_ID,
  type_key: TYPE_KEY,
  name: extractTitle(content),
  body: content,
  properties: [
    { key: "tag", multi_select: tagIds }
  ]
})
```

### Step 5: Link Objects (if specified)

```
if link_to and link_to.length > 0:
  mcp__anytype__API-update-object({
    space_id: SPACE_ID,
    object_id: result.id,
    properties: [
      { key: "links", objects: link_to }
    ]
  })
```

## Output

- Object ID: `result.id`
- Object type used: `TYPE_KEY`
- Tags applied: `tagIds`
- Links created: `link_to`
