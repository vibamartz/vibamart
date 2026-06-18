import os
import re

for file in os.listdir('.'):
    if file.endswith('.py') and file.startswith('refactor_'):
        with open(file, 'r', encoding='utf-8') as f:
            py_code = f.read()
            
        js_code = "const fs = require('fs');\n\n"
        
        # We will wrap the JS translation
        js_code += "async function runRefactor() {\n"
        
        # Translate with open(...) as f: content = f.read()
        for match in re.finditer(r"with open\(['\"](.*?)['\"],\s*['\"]r['\"],\s*encoding=['\"]utf-8['\"]\)\s*as\s*f:\s*([a-zA-Z0-9_]+)\s*=\s*f\.read\(\)", py_code):
            filepath = match.group(1)
            varname = match.group(2)
            js_code += f"  let {varname} = fs.readFileSync('{filepath}', 'utf-8');\n\n"
            
        # Translate variable assignments with triple quotes
        for match in re.finditer(r"([a-zA-Z0-9_]+)\s*=\s*'''(.*?)'''", py_code, flags=re.DOTALL):
            varname = match.group(1)
            content = match.group(2)
            # escape backticks
            content = content.replace('`', '\\`').replace('${', '\\${')
            js_code += f"  const {varname} = `{content}`;\n\n"
            
        # Translate if target in content: replace
        for match in re.finditer(r"if ([a-zA-Z0-9_]+) in ([a-zA-Z0-9_]+):\s*\n\s*\2\s*=\s*\2\.replace\(\1,\s*([a-zA-Z0-9_]+)\)", py_code):
            target = match.group(1)
            content_var = match.group(2)
            replacement = match.group(3)
            js_code += f"  if ({content_var}.includes({target})) {{\n"
            js_code += f"    {content_var} = {content_var}.replace({target}, {replacement});\n"
            js_code += f"  }} else {{\n"
            js_code += f"    console.log('Could not find ' + '{target}');\n"
            js_code += f"  }}\n\n"
            
        # Translate with open(...) as f: f.write(...)
        for match in re.finditer(r"with open\(['\"](.*?)['\"],\s*['\"]w['\"],\s*encoding=['\"]utf-8['\"]\)\s*as\s*f:\s*f\.write\(([a-zA-Z0-9_]+)\)", py_code):
            filepath = match.group(1)
            varname = match.group(2)
            js_code += f"  fs.writeFileSync('{filepath}', {varname});\n\n"
            
        js_code += "}\n\nrunRefactor();\n"
        
        js_file = file.replace('.py', '.js')
        with open(js_file, 'w', encoding='utf-8') as f:
            f.write(js_code)
            
        os.remove(file)
        print(f"Converted {file} to {js_file}")

