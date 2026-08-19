import re
with open('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'onChange=\{e => setFormData\(prev => \(\{ \.\.\.prev, ([a-zA-Z0-9_]+): e\.target\.value \}\)\)\}',
    r"onChange={e => handleFieldChange('\g<1>', e.target.value)}",
    text
)

with open('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
