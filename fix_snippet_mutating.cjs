const fs = require('fs');
let content = fs.readFileSync('src/components/Editor/SnippetLibraryModal.tsx', 'utf8');

const saveLogicOld = `
  const handleSaveCustom = () => {
    if (editingSnippet && editingSnippet.name && editingSnippet.sql) {
      if (editingSnippet.id) {
        updateSnippet(editingSnippet.id, editingSnippet);
      } else {
        addSnippet(editingSnippet as any);
      }
      setEditingSnippet(null);
    }
  };
`;

const saveLogicNew = `
  const handleSaveCustom = () => {
    if (editingSnippet && editingSnippet.name && editingSnippet.sql) {
      // Reject mutating SQL
      const isMutating = /\\b(INSERT|UPDATE|DELETE|DROP|ALTER|GRANT|TRUNCATE)\\b/i.test(editingSnippet.sql);
      if (isMutating) {
        alert("Custom snippets containing administrative or mutating SQL are not allowed due to read-only guard policies.");
        return;
      }
      
      if (editingSnippet.id) {
        updateSnippet(editingSnippet.id, editingSnippet);
      } else {
        addSnippet(editingSnippet as any);
      }
      setEditingSnippet(null);
    }
  };
`;

content = content.replace(saveLogicOld.trim(), saveLogicNew.trim());

fs.writeFileSync('src/components/Editor/SnippetLibraryModal.tsx', content);
