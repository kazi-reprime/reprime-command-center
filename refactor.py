import os
import re

directories = ['app', 'components']

replacements = {
    # Backgrounds
    r'\bbg-white\b': 'bg-surface',
    r'\bbg-black\b': 'bg-surface',
    r'\bbg-slate-50\b': 'bg-surface-raised',
    r'\bbg-slate-100\b': 'bg-surface-raised',
    r'\bbg-slate-200\b': 'bg-surface-hover',
    r'\bbg-slate-800\b': 'bg-surface-raised',
    r'\bbg-slate-900\b': 'bg-surface',
    r'\bbg-zinc-800\b': 'bg-surface-raised',
    r'\bbg-zinc-900\b': 'bg-surface',
    r'\bbg-zinc-950\b': 'bg-surface',
    r'\bbg-blue-500\b': 'bg-accent',
    r'\bbg-blue-600\b': 'bg-accent',
    r'\bbg-emerald-500\b': 'bg-success',
    r'\bbg-emerald-600\b': 'bg-success',
    r'\bbg-rose-500\b': 'bg-error',
    r'\bbg-rose-600\b': 'bg-error',
    r'\bbg-amber-500\b': 'bg-warning',
    r'\bbg-amber-600\b': 'bg-warning',
    
    # Text
    r'\btext-white\b': 'text-text-primary',
    r'\btext-black\b': 'text-text-primary',
    r'\btext-slate-900\b': 'text-text-primary',
    r'\btext-slate-800\b': 'text-text-primary',
    r'\btext-slate-700\b': 'text-text-primary',
    r'\btext-slate-600\b': 'text-text-secondary',
    r'\btext-slate-500\b': 'text-text-secondary',
    r'\btext-slate-400\b': 'text-text-muted',
    r'\btext-slate-300\b': 'text-text-muted',
    r'\btext-zinc-200\b': 'text-text-primary',
    r'\btext-zinc-300\b': 'text-text-secondary',
    r'\btext-zinc-400\b': 'text-text-secondary',
    r'\btext-zinc-500\b': 'text-text-muted',
    r'\btext-blue-500\b': 'text-accent',
    r'\btext-blue-600\b': 'text-accent',
    r'\btext-blue-700\b': 'text-accent-hover',
    
    # Borders
    r'\bborder-slate-100\b': 'border-border',
    r'\bborder-slate-200\b': 'border-border',
    r'\bborder-slate-300\b': 'border-border-strong',
    r'\bborder-slate-800\b': 'border-border',
    r'\bborder-slate-900\b': 'border-border',
    r'\bborder-zinc-700\b': 'border-border-strong',
    r'\bborder-zinc-800\b': 'border-border',
    r'\bborder-zinc-900\b': 'border-border',
    r'\bborder-white\b': 'border-border',
    
    # Hover states
    r'\bhover:bg-slate-50\b': 'hover:bg-surface-hover',
    r'\bhover:bg-slate-100\b': 'hover:bg-surface-hover',
    r'\bhover:bg-slate-200\b': 'hover:bg-surface-hover',
    r'\bhover:bg-zinc-700\b': 'hover:bg-surface-hover',
    r'\bhover:bg-zinc-800\b': 'hover:bg-surface-raised',
    r'\bhover:bg-blue-600\b': 'hover:bg-accent-hover',
    r'\bhover:bg-blue-700\b': 'hover:bg-accent-hover',
    r'\bhover:text-blue-600\b': 'hover:text-accent-hover',
    r'\bhover:text-white\b': 'hover:text-text-primary',
    r'\bhover:text-slate-600\b': 'hover:text-text-secondary',
    r'\bhover:text-slate-700\b': 'hover:text-text-primary',
}

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    new_content = content
    for pattern, replacement in replacements.items():
        new_content = re.sub(pattern, replacement, new_content)
        
    # specific multi-class replacements
    new_content = re.sub(r'bg-accent\s+(hover:bg-accent-hover\s+)?text-white', 'bg-accent text-accent-foreground \\1', new_content)
    new_content = re.sub(r'bg-success\s+(hover:bg-success(-hover)?\s+)?text-white', 'bg-success text-success-foreground \\1', new_content)
    new_content = re.sub(r'bg-error\s+(hover:bg-error(-hover)?\s+)?text-white', 'bg-error text-error-foreground \\1', new_content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))
