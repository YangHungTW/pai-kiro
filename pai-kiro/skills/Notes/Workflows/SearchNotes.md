# SearchNotes Workflow

Search for notes in Anytype by query, type, or tags.

## Input

- **query**: Search text (optional)
- **types**: Filter by object types (optional)
- **tags**: Filter by tags (optional)

## Process

### Step 1: Build Search Query

```typescript
const searchParams = {
  space_id: "bafyreid74whx6w7wtobtzexo3xp3qn4o2ydl5cdfwmnnehs75yvkmn4jjy.q0x6wvfnyzem",
  query: query,
  types: types || ["note", "page", "project"],
  limit: 20
};
```

### Step 2: Execute Search

```typescript
// Search within space
const results = await mcp__anytype__API-search-space(searchParams);

// Or global search across all spaces
const globalResults = await mcp__anytype__API-search-global({
  query: query,
  types: types
});
```

### Step 3: Format Results

For each result, display:
- Name
- Type
- Tags
- Last modified date
- Snippet of content

## Output

- List of matching objects
- Total count
- Suggested refinements if too many results
