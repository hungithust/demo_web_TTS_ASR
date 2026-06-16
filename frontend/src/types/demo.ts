export type DemoGroup = {
  title: string;
  description: string;
  items: DemoItem[];
};

export type DemoItem = {
  title: string;
  subtitle: string;
  detail: string;
};

export type ModelOption = {
  label: string;
  value: string;
};
