type Milestone = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  // Semantic palette name (labels palette) or a hex color.
  color: string;
  position: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export default Milestone;
