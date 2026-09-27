// snippet is inserted as typed; the cursor lands at the first "{}" (or the end if none).
export type LatexCommand = { name: string; snippet: string; preview: string };

const cmd = (name: string, snippet = `\\${name}`, preview = snippet): LatexCommand => ({
  name,
  snippet,
  preview,
});

export const LATEX_COMMANDS: LatexCommand[] = [
  cmd('frac', '\\frac{}{}', '\\frac{a}{b}'),
  cmd('sqrt', '\\sqrt{}', '\\sqrt{x}'),
  cmd('sum', '\\sum_{}^{}', '\\sum_{i=1}^{n}'),
  cmd('int', '\\int_{}^{}', '\\int_{a}^{b}'),
  cmd('prod', '\\prod_{}^{}', '\\prod_{i=1}^{n}'),
  cmd('lim', '\\lim_{}', '\\lim_{x \\to 0}'),
  cmd('binom', '\\binom{}{}', '\\binom{n}{k}'),
  cmd('text', '\\text{}', '\\text{abc}'),
  cmd('mathbb', '\\mathbb{}', '\\mathbb{R}'),
  cmd('vec', '\\vec{}', '\\vec{v}'),
  cmd('hat', '\\hat{}', '\\hat{x}'),
  cmd('bar', '\\bar{}', '\\bar{x}'),
  cmd('overline', '\\overline{}', '\\overline{AB}'),
  cmd('left(', '\\left(  \\right)', '\\left( x \\right)'),
  cmd(
    'pmatrix',
    '\\begin{pmatrix}  \\end{pmatrix}',
    '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'
  ),
  cmd('cases', '\\begin{cases}  \\end{cases}', '\\begin{cases} 1 & x>0 \\\\ 0 \\end{cases}'),
  cmd('infty'),
  cmd('partial'),
  cmd('nabla'),
  cmd('cdot'),
  cmd('times'),
  cmd('div'),
  cmd('pm'),
  cmd('leq'),
  cmd('geq'),
  cmd('neq'),
  cmd('approx'),
  cmd('equiv'),
  cmd('to'),
  cmd('rightarrow'),
  cmd('Rightarrow'),
  cmd('leftrightarrow'),
  cmd('in'),
  cmd('notin'),
  cmd('subset'),
  cmd('cup'),
  cmd('cap'),
  cmd('forall'),
  cmd('exists'),
  cmd('cdots'),
  cmd('ldots'),
  cmd('log'),
  cmd('ln'),
  cmd('sin'),
  cmd('cos'),
  cmd('tan'),
  ...[
    'alpha',
    'beta',
    'gamma',
    'delta',
    'epsilon',
    'theta',
    'lambda',
    'mu',
    'pi',
    'rho',
    'sigma',
    'tau',
    'phi',
    'omega',
    'Gamma',
    'Delta',
    'Theta',
    'Lambda',
    'Pi',
    'Sigma',
    'Phi',
    'Omega',
  ].map((name) => cmd(name)),
];

export const searchLatexCommands = (text: string): LatexCommand[] => {
  if (!text) return LATEX_COMMANDS.slice(0, 20);
  const lower = text.toLowerCase();
  const starts = LATEX_COMMANDS.filter((c) => c.name.toLowerCase().startsWith(lower));
  const contains = LATEX_COMMANDS.filter(
    (c) => !starts.includes(c) && c.name.toLowerCase().includes(lower)
  );
  return [...starts, ...contains].slice(0, 20);
};
