export type UnplacedBlockLike = {
  className?: string;
  course?: any;
  duration?: number;
};

function getCourseName(course: any): string {
  return course?.courseName || course?.name || course?.subject || "Ders";
}

export function summarizeUnplacedBlocks(
  unplacedBlocks: UnplacedBlockLike[],
  diagnose: (block: any) => string
): string {
  if (!unplacedBlocks.length) return "";

  return unplacedBlocks
    .slice(0, 30)
    .map((block, index) => {
      const className = block.className || "Sınıf";
      const courseName = getCourseName(block.course);
      const durationText = block.duration ? ` (${block.duration} saat)` : "";
      return `${index + 1}) ${className} / ${courseName}${durationText} → ${diagnose(block)}`;
    })
    .join(" | ");
}
