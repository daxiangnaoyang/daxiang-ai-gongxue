// Presentation edits requested by the site owner. Keep the upstream snapshot intact.
export function editorialBody(body, sourcePath) {
  const output = [];
  let fence = null;
  let skippedCallout = 0;
  let skippedSection = 0;
  for (const line of body.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (fence === marker[1][0]) fence = null;
    }
    if (skippedCallout) {
      if (/^:::\s+/.test(line)) skippedCallout++;
      else if (/^:::\s*$/.test(line)) skippedCallout--;
      continue;
    }
    if (!fence && /^:::\s+\w+[ \t]+(?:最后核对|参考来源|参考资料|来源说明)\s*$/.test(line)) {
      skippedCallout = 1;
      continue;
    }
    const heading = !fence && line.match(/^(#{1,6})[ \t]+(.+?)\s*$/);
    if (heading) {
      if (skippedSection && heading[1].length <= skippedSection) skippedSection = 0;
      if (/^(参考来源|参考资料|官方资料延伸|来源说明)$/.test(heading[2])) skippedSection = heading[1].length;
    }
    if (skippedSection) continue;
    if (sourcePath === 'docs/recipes/17-desktop-pet.md' && /^!\[codex-desktop-pet-(?:task-bubble|completed-task-bubble)\]/.test(line)) continue;
    let text = line;
    if (!fence) {
      text = text.replace(/(?:官方|社区)?资料最后核对日期[：:]\s*\d{4}-\d{2}-\d{2}。\s*/g, '');
      if (sourcePath === 'docs/start/14-cloud.md') text = text.replace(/，最后核对日期为 \d{4}-\d{2}-\d{2}，因此/, '，');
    }
    output.push(text);
  }
  return output.join('\n');
}
