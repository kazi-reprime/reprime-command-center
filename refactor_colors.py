import os
import re

directories = ['app', 'components']

replacements = {
    r'\bbg-red-50\b': 'bg-error/10',
    r'\bborder-red-100\b': 'border-error/20',
    r'\btext-red-500\b': 'text-error',
    r'\btext-red-600\b': 'text-error',
    r'\btext-red-700\b': 'text-error',
    r'\btext-red-900\b': 'text-error',
    
    r'\bbg-amber-50\b': 'bg-warning/10',
    r'\bborder-amber-100\b': 'border-warning/20',
    r'\btext-amber-500\b': 'text-warning',
    r'\btext-amber-600\b': 'text-warning',
    r'\btext-amber-700\b': 'text-warning',
    r'\btext-amber-900\b': 'text-warning',
    
    r'\bbg-emerald-50\b': 'bg-success/10',
    r'\bborder-emerald-100\b': 'border-success/20',
    r'\btext-emerald-500\b': 'text-success',
    r'\btext-emerald-600\b': 'text-success',
    r'\btext-emerald-700\b': 'text-success',
    r'\btext-emerald-900\b': 'text-success',
    
    r'\bbg-green-50\b': 'bg-success/10',
    r'\bborder-green-100\b': 'border-success/20',
    r'\btext-green-500\b': 'text-success',
    r'\btext-green-600\b': 'text-success',
    r'\btext-green-700\b': 'text-success',
    r'\btext-green-900\b': 'text-success',
    
    r'\bbg-blue-50\b': 'bg-accent/10',
    r'\bbg-blue-100\b': 'bg-accent/20',
    r'\bborder-blue-100\b': 'border-accent/20',
    r'\btext-blue-500\b': 'text-accent',
    r'\btext-blue-600\b': 'text-accent',
    r'\btext-blue-700\b': 'text-accent',
    r'\btext-blue-900\b': 'text-accent',
    
    r'\bbg-indigo-50\b': 'bg-accent/10',
    r'\bborder-indigo-100\b': 'border-accent/20',
    r'\btext-indigo-500\b': 'text-accent',
    r'\btext-indigo-600\b': 'text-accent',
    
    r'\bhover:bg-blue-50\b': 'hover:bg-accent/10',
    r'\bhover:bg-blue-100\b': 'hover:bg-accent/20',
    r'\bhover:bg-red-100\b': 'hover:bg-error/20',
    r'\bhover:bg-green-100\b': 'hover:bg-success/20',
    r'\bhover:bg-amber-100\b': 'hover:bg-warning/20',
    r'\bfocus:ring-blue-100\b': 'focus:ring-focus',
    r'\bfocus:border-blue-300\b': 'focus:border-accent',
    
    r'\bbg-accent text-text-primary\b': 'bg-accent text-accent-foreground',
    r'\bbg-error text-text-primary\b': 'bg-error text-error-foreground',
    r'\bbg-success text-text-primary\b': 'bg-success text-success-foreground',
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for pattern, replacement in replacements.items():
        new_content = re.sub(pattern, replacement, new_content)
        
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))
