import os
import re

builder_dir = 'src/components/Analysis/builders'
for filename in os.listdir(builder_dir):
    if not filename.endswith('.tsx'): continue
    filepath = os.path.join(builder_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove import of AnalysisSqlGenerator
    content = re.sub(r"import \{ AnalysisSqlGenerator \} from '\.\.\/\.\.\/\.\.\/services\/analysisSqlGenerator';\n?", "", content)
    
    # Ensure DatabaseApiClient is imported
    if "DatabaseApiClient" not in content:
        content = re.sub(r"(import .*? from 'lucide-react';\n)", r"\1import { DatabaseApiClient } from '../../../services/databaseApi';\n", content)

    # Change handleGenerate or similar methods to be async
    content = content.replace("const handleGenerate = () => {", "const handleGenerate = async () => {")
    content = content.replace("const handleGenerate = (evt) => {", "const handleGenerate = async (evt) => {")
    content = content.replace("const handleGenerate = (e: React.FormEvent) => {", "const handleGenerate = async (e: React.FormEvent) => {")
    
    # In DataQualityBuilder, they do `let query; switch... query = AnalysisSqlGenerator.generateRowCount(...);`
    if "DataQualityBuilder" in filename:
        content = content.replace("let query: GeneratedAnalysisQuery;", "let query: GeneratedAnalysisQuery;")
        content = content.replace("query = AnalysisSqlGenerator.generate", "query = await DatabaseApiClient.generateAnalysis('generate")
    else:
        content = content.replace("const query = AnalysisSqlGenerator.generate", "const query = await DatabaseApiClient.generateAnalysis('generate")

    # The arguments: AnalysisSqlGenerator.generateBasic(table.schema, table.name, ...
    # Becomes: DatabaseApiClient.generateAnalysis('generateBasic', table.schema, table.name, ...
    
    # We need to replace `AnalysisSqlGenerator.generateX(` with `await DatabaseApiClient.generateAnalysis('generateX', `
    content = re.sub(r"AnalysisSqlGenerator\.generate([a-zA-Z0-9_]+)\(", r"await DatabaseApiClient.generateAnalysis('generate\1', ", content)

    with open(filepath, 'w') as f:
        f.write(content)
