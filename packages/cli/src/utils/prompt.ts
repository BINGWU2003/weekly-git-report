import { cyan, green, red } from "kolorist";
import prompts from "prompts";

export { prompts };

export function intro(message: string): void {
  console.log();
  console.log(`${green("◆")}  ${cyan(message)}`);
  console.log(`${green("│")}`);
}

export function outro(message: string): void {
  console.log(`${green("└")}  ${message}`);
  console.log();
}

export function promptOptions() {
  return {
    onCancel: () => {
      console.log(`${red("✖")}  Operation cancelled.`);
      process.exit(1);
    },
  };
}
