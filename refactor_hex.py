import os
import re

directories = ['app', 'components']

replacements = {
    r'bg-\[\#08224d\]': 'bg-background',
    r'bg-\[\#0E3470\]': 'bg-background',
    r'bg-\[\#0c2957\]': 'bg-surface',
    r'bg-\[\#123e80\]': 'bg-surface-raised',
    r'bg-\[\#09224d\]': 'bg-surface-hover',
    r'bg-\[\#FFCC33\]': 'bg-accent',
    r'hover:bg-\[\#ffe066\]': 'hover:bg-accent-hover',
    r'text-\[\#FFCC33\]': 'text-accent',
    r'text-\[\#0E3470\]': 'text-accent-foreground',
    r'border-\[\#FFCC33\]': 'border-accent',
    r'focus:border-\[\#FFCC33\]': 'focus:border-accent',
    r'border-\[\#FFCC33\]/([0-9]+)': 'border-accent/\g<1>',
    r'bg-\[\#FFCC33\]/([0-9]+)': 'bg-accent/\g<1>',
    r'bg-\[\#09224d\]/([0-9]+)': 'bg-surface-hover/\g<1>',
    
    # other colors spotted
    r'bg-\[\#153B75\]': 'bg-surface',
    r'bg-\[\#1c4a8f\]': 'bg-surface-raised',
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
