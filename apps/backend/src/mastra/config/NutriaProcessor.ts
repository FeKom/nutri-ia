import { MessageList } from "@mastra/core/agent"
import { MastraDBMessage } from "@mastra/core/memory"
import type {
Processor,
ProcessInputStepArgs,
ProcessInputStepResult,
ProcessInputArgs,
ProcessInputResult,
} from "@mastra/core/processors"

// import type { MastraDBMessage } from '@mastra/core/memory'



export class NutriaProcessor implements Processor {
  readonly id = "nutria-processor"
  private maxSteps: number = 3
  constructor(maxStepts: number) {
    this.maxSteps = maxStepts
  }

  async processInputStep({
    stepNumber,
    systemMessages,
  }: ProcessInputStepArgs): Promise<ProcesoksInputStepResult> {
    if(stepNumber === this.maxSteps -1)
      return {
        tools: {

        }
      }
    
  }
}