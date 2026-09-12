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
    
    # We only use re.sub, no replace for the call!
    content = re.sub(r"AnalysisSqlGenerator\.generate([a-zA-Z0-9_]+)\(", r"await DatabaseApiClient.generateAnalysis('generate\1', ", content)

    with open(filepath, 'w') as f:
        f.write(content)
