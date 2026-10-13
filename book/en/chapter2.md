# Chapter 2 Designing Evaluation Tasks

For an evaluation task to be truly runnable, several questions need to be resolved in sequence:

First, the task itself must be described completely, including what information a task specification needs to record;

Second, it must be clear what input and environment the Agent starts from;

Then, the expected result after task completion and the constraints that must be followed during execution need to be specified.

After the task is written, it still needs to be checked for clarity, feasibility, and realism, and finally validated through actual execution to confirm that the design holds.

## 2.1 Task Specification

A task specification (`Task Specification`) can be understood as **a complete description of an evaluation task**. It includes not only the user's request to the Agent, but also the environment required to perform the task, the result that should ultimately be achieved, the constraints that must be observed during execution, and the information that needs to be inspected after the evaluation is complete[1][2][3].

Its purpose is straightforward: another person who reads only this specification should be able to recreate the same test conditions and know what to inspect after the task finishes. If critical initial data, tool configuration, or judging criteria are missing, then a rerun is no longer testing the same task in practice.

Conventional LLM evaluations often need to store only the input and expected output. For example, given the name of a country, the expected output is its capital. This structure works well for a single model call because the model itself does not change the external world[3].

Agent tasks are more complex. An Agent may query a database, modify a file, create an order, or even call an external service. Therefore, storing only "what the input is" and "what the answer is" is insufficient. The task specification must also state **the environment in which the Agent executes and how that environment should change once execution is complete**.

![List of dataset entries. Each row is a test case containing an Item id, source, status, creation time, and two columns: Input and Expected Output. In the example, Input is a country name and Expected Output is the corresponding capital; for example, when Input is Egypt, Expected Output is Cairo](../images/dataset-input-expected-output.png)

Caption: A dataset entry contains only two fields, input and expected output, with each row forming a reusable test case. Image from [3].

### 2.1.1 Components of a Task Specification

A complete task specification usually needs to include five aspects:

1. **Task input**: what information the Agent can access at the beginning;
2. **Execution environment**: what tools the Agent can use, and what initial data and permissions it has;
3. **Expected result**: what should be true once the task is complete;
4. **Behavioral constraints**: what rules must not be violated during execution;
5. **Evaluation evidence**: what information should be read after the task finishes to determine whether the preceding requirements were satisfied.

These five parts address different questions.

- The task input and execution environment together define the Agent's **starting conditions**. For example, what the user said, what prior conversation already exists, what orders are currently in the database, and what APIs the Agent is allowed to call.

- The expected result and behavioral constraints define **what it means to complete the task**. The former focuses on the end result, such as an order being canceled, a file being created, or the correct amount being returned; the latter focuses on requirements that must be followed while completing the task, such as obtaining user confirmation before issuing a refund or allowing the Agent to modify only the current user's own orders.

- Evaluation evidence specifies **what the evaluation system will inspect to verify those requirements**. If the system needs to verify that an order was actually canceled, it must read the final order state; if it needs to check whether confirmation was obtained before a refund, it must retain the full conversation and tool-call records.

Therefore, these five parts have a natural order: **first determine the task and environment the Agent faces, then define what result counts as success and what constraints apply, and finally decide what evidence must be retained to verify them.**

> For example, consider a retail customer-service task in which the user wants to return a mug and asks how much money can be refunded. At the beginning of the task, the corresponding order already exists in the system, and the Agent can query the order and initiate a return. According to the business rules, the item must be in an eligible return state, and the user must explicitly confirm before the refund is actually submitted.
>
> The task specification could then be written as follows:
>
> - **Task input**: the user requests a return and identifies the relevant item;
> - **Execution environment**: contains the user's order data and provides order-query and return APIs;
> - **Expected result**: the correct order enters the return state, the correct refund amount is generated, and the Agent tells the user the refund amount;
> - **Behavioral constraints**: the item must satisfy the return policy, confirmation must be obtained before the refund, and unrelated account information must not be modified;
> - **Evaluation evidence**: the final order state, payment records, the conversation between the Agent and the user, and the relevant tool-call records.
>
> With this structure, what the task requires, what counts as success, and how the result will ultimately be checked are all explicit.



![Example fields in a complete task specification. The initial environment records existing data files in the working directory, configured account permissions, and available tools; prompt records the user request; expected behavior records two required actions; outcome-level evaluation criteria check whether a file was produced, whether the amount matches the source data, and whether comparative analysis is included; efficiency and safety evaluation criteria check total execution time and whether there were unconfirmed write operations or data exfiltration](../images/task-spec-fields.png)

Caption: A completed task specification separates input, expected behavior, expected result, and constraints into distinct fields, and labels checks as either required or bonus criteria. Image from [7].

## 2.2 Task Input and Execution Environment

Task input and the execution environment together determine **the conditions from which the Agent begins the task**.

Task input concerns what the Agent knows at the outset, while the execution environment concerns what it can access and change. Both should resemble real usage conditions as closely as possible; otherwise, the evaluation may only be measuring an artificially simplified task rather than the problems the product actually faces[1][4].

### 2.2.1 Task Input

(1) The task input should first make clear: **which information should be given directly to the Agent at the beginning of the task, and which information the Agent should obtain on its own.**

The most direct component is the user's request. For example:

> Help me return the mug I bought yesterday.

Beyond that, the Agent may naturally have access to some context, such as prior conversation history, information about the currently logged-in user, the current state of a code repository, or business context already supplied by the system. **Do not** place all information that the Agent would normally need to discover for itself directly into the user's request merely to make the test easier.

> Some early tool-use benchmarks placed all information required to complete the task directly into the initial instruction. For example, they explicitly provided the order number, product ID, refund method, and other required fields. This makes the task easy to execute and automatically grade, but it bypasses a problem that real-world Agents often need to solve: a user may only say "return the mug I bought yesterday," requiring the Agent to look up the order itself and, when necessary, ask the user follow-up questions[4].

Information the user knows and would normally volunteer can be included in the user request; context that the system would normally provide to the Agent can be placed directly into the initial state; information that can only be obtained by querying the business system should be retrieved by the Agent through tools.



(2) Multi-turn tasks also need to account for information the user provides later.

For example, the Agent may ask:

> Do you mean the blue mug in the order?

The user may then reply:

> Yes, that one.

To run this kind of test automatically, a user simulator can continue to play the role of the user. The simulator responds to the Agent according to a predefined user intent and known information, but it should not know what happens between the Agent and its internal tools[4]. **Isolation between the test system and the Agent under test is important**. The order state in the database should be queried by the Agent itself; the simulated user should not proactively reveal the answer merely because the test system knows it.

Not every task requires a user simulator. It is only necessary for tasks that involve follow-up questions, confirmations, or multi-turn negotiation. Tasks whose requirements can be fully expressed in a single request can use single-turn input directly. Introducing an unnecessary simulator only adds another source of randomness.



(3) Task input also has a clear boundary: **provide only information that would normally be visible to the Agent in production. Expected outcomes and annotations used for grading must not be included in the input.**

For example, a task may store two kinds of information at the same time: one kind is supplied to the user simulator or Agent; the other records the correct database changes, reference answer, or other annotations used for final grading[4]. The latter is invisible to the Agent and is used only to drive simulation and judge the result.

This separation ensures that the evaluation genuinely measures the Agent's reasoning and execution capabilities. If the reference answer, target state, or correct action appears directly in the input, the Agent may simply follow the answer, making the resulting score meaningless.

### 2.2.2 Execution Environment

The execution environment describes the conditions under which the Agent performs the task.

Five aspects usually need to be specified: **available tools, initial data, access permissions, business rules, and external services on which the task depends.**

1. First, specify which tools the Agent can use. The task specification should list the available APIs and their parameters, while distinguishing between interfaces that only read information and those that actually modify external state. For example, `get_order()` only queries an order, whereas `cancel_order()` changes the order state. This distinction directly affects what evidence must be retained later and also determines which operations require additional permission or confirmation checks.

2. Second, specify the environment state at the beginning of the task. For an order-management Agent, this may include which orders the user currently has, the status of those orders, and which user they belong to; for a coding Agent, it may include the repository version, existing files, and dependency state. The initial state should be specified in enough detail to recreate the same test scenario. Otherwise, different trials may in fact be evaluating different tasks.

3. Permissions are also part of the environment. The task must specify what data the Agent is allowed to read or modify. For example, whether it may process only the current user's orders, whether it can access other accounts, and whether it is allowed to modify payment methods. If the permission boundary is unclear, it becomes difficult to determine whether a particular action is correct behavior or an unauthorized action.

4. Business rules must also be part of the execution environment, but different rules are implemented in different ways. Some rules are already enforced directly by the API. For example, in an airline scenario, if the Agent uses a payment ID that does not belong to the current user, the API may reject the request and return an error[4]. Other rules are not automatically checked by the API and must instead be understood and followed by the Agent. For example, different membership tiers and cabin classes may correspond to different free baggage allowances, while the API may allow the Agent to enter the number of bags directly without checking whether that number complies with policy[4]. The former type of rule is enforced by the system itself; the latter must be communicated to the Agent through business-policy documentation and explicitly checked during evaluation. The task specification needs to distinguish between the two. Otherwise, when an error occurs, it will be difficult to tell whether the system failed to block the action or the Agent failed to follow the rule.

5. If the task also depends on a payment gateway, third-party API, or another external service, the evaluation environment must specify how those dependencies are provided. Otherwise, the same task may produce incomparable results simply because external service conditions differ.



The execution environment must also ensure that different trials begin from the same initial state as much as possible. If a previous test leaves behind files, caches, database modifications, or other state, the next Agent may gain information it should not have. Anthropic describes an internal evaluation case in which an Agent gained an extra advantage by inspecting Git history left behind by a previous trial[1].

Shared state can also create another problem: multiple tasks may fail simultaneously because of the same environment failure. Examples include a disk filling up, a service becoming unavailable, or a previous task modifying shared data. In such cases, the failures no longer primarily reflect Agent performance and are instead contaminated by the test environment[1].



Finally, the execution environment should preserve the same mode of operation as production as closely as possible. Reproducing the entire production environment is usually unrealistic, but the core tools, data structures, permission mechanisms, and business processes should not differ substantially from the real system[1]. One way to test this is to run the same set of tasks in both an offline evaluation environment and an online shadow environment, then compare the conclusions from the two. If the same Agent consistently shows clearly different results across the two environments, the offline environment should be examined for drift from real usage conditions[2].

## 2.3 Expected Results and Behavioral Constraints

Next, two additional things need to be made explicit: **what result should exist after the task is completed, and what constraints must be followed during execution.**

The former is the expected result; the latter is the behavioral constraint. Together, they translate the success criteria defined in Chapter 1 into concrete task-level requirements[4][5].

### 2.3.1 Expected Results

Expected results fall into three categories, each corresponding to a different validation method. The categories are not mutually exclusive; a task may use all three.

The first category is **key information the Agent should deliver to the user**. This is appropriate for tasks with a clear answer or fixed key fields, where grading focuses on whether the reply contains the required information.

> For example, in a refund task, the Agent needs to tell the user the correct refund amount; in an order-status task, it needs to return the correct order state; if the task requires explaining the next step, the reply should also be checked for that information.



The second category is **the state the external environment should reach after the task is complete**, such as an order state, database record, generated file, or test result. Whenever the result can be verified directly through environment state, this type of result should be prioritized.

> For example: the order state has changed to "canceled"; the correct refund record has been added to the database; the specified file has been generated; the modified code passes the tests.



The third category is **critical behaviors or facts that must occur during execution**. Some requirements appear neither in the final reply nor in the final environment state. If those behaviors affect correctness, safety, or user rights, they should be included in the expected result and checked through the execution record.

> For example, whether the Agent verified that the item was eligible for return before processing it, whether it checked the required cabin information before changing a flight, or whether it obtained user confirmation before executing an irreversible operation.



The task specification should record only the **results and key behaviors that genuinely affect task completion**, and usually should **not** prescribe a fixed tool-call order. An explicit sequence is necessary only when the order of steps itself affects correctness or safety[1]. Otherwise, turning a pre-imagined tool-call sequence into a hard requirement makes the test overly brittle and can cause reasonable alternative paths to be misclassified as failures[1]. A single task often has multiple valid execution paths. For example, the Agent may query the order before checking the refund policy, or confirm the user's intent before querying the order. As long as these paths comply with the rules and ultimately produce the correct result, they should be allowed to pass.



Expected results should also avoid purely open-ended generation requirements. When automated judging is needed, asking a model to make a judgment is generally more reliable than asking it to generate freely. Therefore, requirements should be narrowed into **judgeable forms**, such as comparing two options side by side, assigning an item to one of several categories, or scoring it against predefined criteria[6].

> For example, "provide a good analysis" is difficult to judge consistently, whereas "identify the two regions with the largest decline in sales and provide the corresponding percentage decreases" is much more explicit.



### 2.3.2 Behavioral Constraints

Behavioral constraints answer the question: **what boundaries must not be crossed while completing the task.**

Common behavioral constraints fall into four main categories.

The first category is **business rules**. These specify, for example, the conditions under which a refund is allowed, which tickets can be changed, or whether a promotion is eligible for use. These rules come from real business processes, and the Agent must follow them even when it is otherwise capable of fulfilling the user's request.

The second category is **permission restrictions**. These define which resources the Agent is allowed to read or modify. For example, a customer-service Agent may be allowed to process only the current user's orders and may not access or modify another user's data; a task may also explicitly prohibit changing the user's default payment method.

The third category is **confirmation requirements before an operation**. For operations with significant consequences, such as canceling an order, issuing a refund, or deleting a file, the business may require the Agent to obtain explicit user confirmation before execution. This requirement must be stated separately because the final result alone cannot prove whether confirmation occurred.

The fourth category is **time and resource limits**. Examples include limits on the number of tool calls, the number of dialogue turns, elapsed time, or Token consumption. These constraints mainly control the efficiency and cost of task completion.



Behavioral constraints cannot be checked solely through the final state. The final state can answer only whether the task was ultimately completed, not whether all execution requirements were followed. Conditions involving authorization, confirmation, and business rules also require inspection of the conversation and tool-call records.

> For example, the user may indeed be eligible for a return, and the Agent may successfully create the correct refund record, yet the Agent submitted the refund before the user explicitly confirmed it. From the perspective of the final database state, the task result is entirely correct; from the perspective of execution rules, the operation is still problematic[4].



## 2.4 Task Quality

After a task has been written, **the task itself must first be checked for reliability**. Otherwise, failures observed during evaluation may come from ambiguous task wording, insufficient environment conditions, or flawed judging requirements rather than from limitations in the Agent.

A qualified evaluation task should satisfy at least three requirements: **clear description, feasibility, and realism**[1][6].

### 2.4.1 Clarity

Clarity first requires that the task **provide enough information** for the Agent to complete it and for the result to be judged afterward.

Specifically, every expected result and behavioral constraint in the task should be grounded in the task input, execution environment, or provided business rules. The grader must also not check hidden requirements that the Agent could not know and that the task specification never stated.

> For example, a task may ask the Agent to write a script without specifying where the file should be saved, while the grader checks only one fixed path. The Agent may complete the task correctly and still be marked as failing merely because the file was saved to another reasonable location[1]. This kind of failure indicates a problem in the task specification or judging method and should not be counted directly as an Agent failure.



For tasks that are automatically judged against a unique target state, it is also necessary to check whether the existing conditions are sufficient to determine that target state.  

> For example, a task may require the Agent to issue a refund using the user's preferred payment method, but the preferred payment method is neither specified in the task input nor inferable from the environment. Different reasonable choices may then produce different final database states. If the grader accepts only one of them, it will incorrectly reject the other valid outcomes.

In this case, the task can explicitly specify the user's identity, intent, and preferences so that, together with the business rules, they determine a unique final result[4]. The requirement is that the Agent **may follow different reasonable execution paths**, while all of them should ultimately point to **the same judgeable result**.



One way to check clarity is to <u>have people familiar with the domain independently read the task and separately decide what conditions should result in a pass</u>. If different readers interpret the task requirements, expected results, or constraints in meaningfully different ways, the task is still ambiguous and should be revised further[1].

It is also useful to <u>have a human actually perform the task using only the information currently provided</u>. If even a human has to guess in order to complete it, or needs information not provided in the task, then the task is likewise unsuitable for direct inclusion in the evaluation suite.



### 2.4.2 Feasibility

Feasibility requires that **an Agent following the instructions, or a human operator, can reach the task's defined success criteria**. It rules out two cases: tasks that are inherently unsolvable and tasks whose expected results conflict with their constraints.

The most direct way to check this is to <u>prepare a reference solution for the task</u>. A reference solution is an output or execution path that has already been verified to satisfy the task requirements. It serves two purposes: first, it proves that the task is actually solvable; second, it provides a basic check that the environment and grader are configured correctly[1]. Therefore, **after the task is written, the reference solution should ideally be run end to end at least once**. If even the reference solution cannot pass, there is still a problem in the task specification, execution environment, or grading criteria, and the task is not ready for batch evaluation.



If a task consistently fails across a large number of trials, the task itself should also be re-examined. A persistent zero pass rate may indeed mean that the current Agent cannot complete the task, but it may also result from missing input, incorrect environment configuration, or unreasonable grading criteria[1]. Therefore, before using such results to evaluate the Agent, at minimum confirm that the reference solution can pass reliably.



### 2.4.3 Realism

Realism requires evaluation tasks to **reproduce situations that real users are likely to encounter as faithfully as possible**. This includes not only the task itself, but also the user input, existing context, and execution environment. All of these conditions should align with how the system is actually used.



Tasks generally need to cover two kinds of scenarios at the same time: <u>high-frequency, representative tasks</u> and <u>edge cases that are likely to expose problems</u>, such as abnormal inputs, conflicting requirements, or situations constrained by business rules. Neither category can be omitted. Evaluating only one side makes it easy for the Agent to optimize in a single direction. A practical approach is to <u>check both positive and negative directions</u>; the boundary between the two is often difficult to define correctly in one pass and usually needs to be stabilized through repeated adjustments to tasks and rules[1].

> For example, if an evaluation checks only "whether the Agent searches when it should," the easiest way to improve the score may be for the Agent to search on almost every question. To determine whether it has actually learned when search is necessary, the evaluation also needs a second category of tasks (no search needed): these questions can already be answered from available information and should not trigger additional search[1].



Tasks can come from manual acceptance testing, real production execution traces, user feedback, and scenarios written by domain experts. Cases that have not yet appeared in production but are expected to arise in the future can also be supplemented with synthetic examples.

Different sources are suited to different purposes. Tasks derived from production execution traces are closer to the distribution of real user inputs; expert-designed tasks are better suited to covering lower-frequency scenarios that still require focused validation.

For an individual task, realism mainly requires a clear scenario source, complete context, and a user goal that is genuinely worth validating. Whether a collection of tasks, taken together, covers the full range of situations the product needs to handle belongs to the subsequent organization and composition of the evaluation suite[3][6].



## 2.5 Task Validation

Task validation confirms that three elements can jointly support a fair test: the task specification, the execution environment, and the expected results. This step happens before the task is added to the evaluation suite. Its purpose is to uncover problems before batch execution rather than explain anomalies after results have already been produced[1][4].

Validation consists of four steps.

- Run the task once using a reference solution or human procedure to confirm that it is feasible and that the expected results do not conflict with the behavioral constraints.
- Re-run the task from a clean initial state to verify that environment isolation is working and to observe whether each execution behaves as the task expects.
- Review the execution record to check whether the Agent received the information required to complete the task and whether all evidence required for grading was captured.
- When ambiguity, missing environment state, or grading loopholes are found, revise the task specification and then validate it again.

The third step is the easiest to skip and the one that most often uncovers problems. Reading the execution record answers two questions at once: did the Agent receive enough information, and were the records required for judging captured completely? Insufficient information is a task-design defect; incomplete records are an observability defect. The two require different fixes. This step is also necessary because it helps distinguish the nature of a failure: did the Agent genuinely make a mistake, or did the grader reject a valid solution[1]?

The four steps form a loop. A change made in one round turns the task into a new task, invalidating the previous validation and requiring another run. The loop ends when the task specification stabilizes: another run no longer causes further changes.

Once validation passes, the task specification can be added to the evaluation suite, where its expected results, behavioral constraints, and evaluation evidence are consumed by the grader.

## References

1. Anthropic. [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). `Step 2: Write unambiguous tasks with reference solutions`, `Step 3: Build balanced problem sets`, `Step 4: Build a robust eval harness with a stable environment`.
2. Meituan Tech Team. [Agent Evaluation White Paper Series 01: An Overview of Agent Evaluation](https://tech.meituan.com/2026/09/10/Agent-Evaluation-White-Paper-01.html). `II. Offline Evaluation: Gating Changes`.
3. Langfuse. [Datasets](https://langfuse.com/docs/evaluation/experiments/datasets). `Why use datasets?`, `Upload or create new dataset items`.
4. Sierra. [τ-bench: benchmarking AI agents for the real-world](https://sierra.ai/resources/research/tau-bench) (paper: *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains*, arXiv:2406.12045v1). `1. Introduction`, `3 τ-bench`, `4. Benchmark Construction`, `4.2 Key Characteristics`.
5. OpenAI. [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills). `1. Define success before you write the skill`.
6. OpenAI. [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices?api-mode=responses). `What are evals?`, `How to read evals`.
7. Meituan Tech Team. [Agent Evaluation White Paper Series 01: An Overview of Agent Evaluation](https://tech.meituan.com/2026/09/10/Agent-Evaluation-White-Paper-01.html). `2.1.1 Composition of the Evaluation Suite`.
