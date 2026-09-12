const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/QueryLibraryModal.tsx', 'utf8');

content = content.replace(
  "const [sortBy, setSortBy] = useState<'updated' | 'created' | 'nameAsc' | 'nameDesc'>('updated');",
  "const [sortBy, setSortBy] = useState<'updated' | 'created' | 'nameAsc' | 'nameDesc' | 'favorites'>('updated');"
);

content = content.replace(
  /<option value="nameDesc">Name \(Z-A\)<\/option>/,
  '<option value="nameDesc">Name (Z-A)</option>\n                <option value="favorites">Favorites First</option>'
);

const oldSort = `
    result.sort((a, b) => {
      // Always put favorites first if sorting by something else? Let's just follow the sort option strictly.
      switch (sortBy) {
        case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });
`;

const newSort = `
    result.sort((a, b) => {
      if (sortBy === 'favorites') {
        if (a.isFavorite === b.isFavorite) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return a.isFavorite ? -1 : 1;
      }
      switch (sortBy) {
        case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });
`;

content = content.replace(oldSort.trim(), newSort.trim());

fs.writeFileSync('src/components/Editor/QueryLibraryModal.tsx', content);
