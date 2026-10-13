# Chapter 4 Organizing Evaluation Suites and Interpreting Experimental Results

Taken together, the outputs of the first three chapters are already sufficient to produce scores: the success criteria define what is required, the task specification fixes how it is measured, and the graders produce the judgments. But a score by itself still cannot answer the question, “Can this version be released?”

To move from evaluation scores to a release decision, three additional problems need to be addressed.

- The first is **comparability**: which conditions must be held fixed in a version comparison so that score changes can be attributed to the candidate version itself.
- The second is **randomness**: Agent execution is stochastic, so a single result is not enough to represent stable performance; repeated trials and corresponding metrics are needed to describe it.
- The third is **case-level review**: aggregate scores can hide newly introduced failures on specific tasks, so the final judgment must return to the individual tasks and execution records.

These three layers address the problems that offline evaluation can observe. Problems that are not covered by the evaluation suite and only emerge in real-world online usage will be discussed in Chapter 5.

## 4.1 Evaluation Suites and Experiments

An **evaluation suite (`Evaluation Suite`)** is a collection of tasks organized to measure specific capabilities or behaviors; it expresses the measurement objective[1]. A **dataset (`Dataset`)** is the storage layer for task inputs, optional expected results, and metadata[3][4]. Their responsibilities are different: an evaluation suite answers “What do I want to measure?”, while a dataset answers “Where is the task data stored, and how is it changed?” The same evaluation suite may be implemented in one dataset or distributed across several datasets.

In this document, “evaluation suite” refers to the measurement objective, while “dataset” refers to versionable task data. This distinction becomes useful in the experimental-control section below: the measurement objective is fixed through documentation and convention, while the concrete task data is fixed through dataset versions.

An **experiment (`Experiment`)** is the process of running an Agent version on an evaluation suite under a fixed configuration and having the resulting executions scored by graders[4]. An **experiment run (`Experiment Run`)** covers all selected dataset items. During the run, each data item produces an execution record and corresponding output; once graders are attached, these execution results are further converted into scores[4].

![Experiment flow. Each input item in the dataset on the left is sent to the Task in the middle, where external code or prompts process it iteratively to produce an output; Results on the right collect each output, and an Evaluation Method then produces the corresponding Score using code-based scoring, model-based judging, or human scoring](../images/experiment-flow.jpg)

Caption: The dataset provides inputs, the Task produces outputs, and the evaluation method then converts each input-output pair into a score. Image from [4].

These objects form a complete experimental chain: **the evaluation suite defines the measurement scope, the dataset version fixes the actual tasks used, the experiment run produces execution evidence, and graders then generate scores from that evidence.** The purpose of the experimental controls described below is to ensure that the baseline (`Baseline`) and candidate version pass through the same measurement chain so that the resulting scores can be compared directly.

## 4.2 Organizing the Evaluation Suite

Chapter 2 explained how to design an individual evaluation task. Once multiple tasks are combined into an evaluation suite, the collection itself needs to be organized further: **what role this set of tasks serves, from which levels it observes the Agent, and whether the tasks collectively cover the capabilities and risks that actually matter.**

These three questions correspond to the evaluation suite’s **purpose, measurement scope, and task coverage**. One set of tasks may simultaneously serve regression protection and end-to-end evaluation, while another may target a new capability and measure specific stages in the execution process. The purpose of organizing an evaluation suite is to give different tasks clear measurement roles and make them work together to provide sufficiently complete coverage.

### 4.2.1 Purpose

An evaluation suite should first make clear **what stage of the Agent lifecycle it is intended to observe**. During Agent iteration, two kinds of suites are usually needed at the same time: one for exploring capabilities that are not yet stable, and another for protecting capabilities that have already been validated[1].

A **capability eval (`Capability Eval`)** focuses on difficult tasks that the Agent still cannot complete reliably. It answers the question, “Which capabilities does this Agent still need to improve?” For that reason, such a suite should usually retain clear headroom for improvement when it is created; if every task already passes consistently, the suite will have little ability to reflect further capability gains[1].

A **regression eval (`Regression Eval`)** focuses on whether the Agent can still complete tasks that it has already been shown to handle. It answers the question, “Can it still reliably do what it already knew how to do?” The expected pass rate for this type of task is usually high. If tasks that previously passed consistently begin to fail, that indicates that an existing capability may have regressed[1].

The two are not permanently separate. After sustained optimization, if a capability task can be completed reliably, its value as a capability signal decreases, and it can be moved into the regression suite. Its role then changes from “determine whether the Agent can do this” to “protect a capability the Agent has already acquired”[1]. At the same time, new difficult tasks need to be added continuously to the capability suite; otherwise, as old tasks become saturated, the suite will no longer point to the next area for improvement[1].

In practice, both types of suites usually need to run together. Changes to the model, prompt, tools, or workflow may improve a new capability while also affecting other behaviors that were already stable. Capability evals determine whether the intended improvement occurred, while regression evals check whether that improvement came at the cost of existing capabilities[1].

### 4.2.2 Measurement Scope

After the purpose of the evaluation suite is established, the next question is **from which levels the Agent’s performance should be observed**. In most cases, both end-to-end outcomes and key process signals should be retained[2].

**End-to-end evaluation** looks at the user goal and final outcome, asking whether a complete task was actually completed. For example, when the user requests a refund, did the correct refund result actually occur? When the user asks for a file to be generated, was the target file actually created? This directly reflects the overall capability delivered by the Agent to the outside world and is therefore usually one of the most important signals for judging overall system performance[2].

The limitation of end-to-end results is weak diagnostic power. Suppose the success rate of a set of tasks drops from 68% to 55%. This change shows that complete-task performance worsened, but by itself it does not reveal whether the problem occurred in retrieval, planning, tool use, or result generation.

For that reason, **process evaluation** is also needed to observe critical stages in the execution chain, such as whether retrieval returned the correct information, whether the right tools were called, whether parameters were correct, or whether a particular subtask was completed[2]. If the end-to-end result declines and the success rate of one critical stage also drops substantially, the likely problem area can be narrowed further.

There is also an important reverse relationship between the two perspectives: **if all existing process metrics remain stable while the end-to-end result declines, that indicates that the current process evaluations may still have coverage blind spots**[2].

> For example, suppose a refund Agent shows no change in identity-verification success, user-confirmation success, or refund-tool invocation success, yet the overall refund success rate drops significantly. Reviewing the newly introduced failures reveals that the Agent often selects the wrong item to refund in orders containing multiple items, while the current process evaluations never check that step. In this case, the new failure should be turned into a new process evaluation rather than continuing to observe only the original metrics.

End-to-end evaluation therefore mainly identifies **whether overall performance has become abnormal**, while process evaluation helps explain **where the abnormality occurred**[2]. Without the former, the team may see that all known modules appear healthy while the user’s actual task has already failed; without the latter, the team may know that performance deteriorated without knowing which part of the system to inspect.

Process evaluation also does not need to be decomposed into very fine-grained categories from the beginning. A suite can first be built around end-to-end tasks and a small number of core modules. When real experiments produce the situation “we know overall performance has worsened, but we still cannot identify the cause,” the evaluation can then be decomposed further. Over time, this may produce more specific process evals for the knowledge base, retrieval, tool calls, and so on[2]. Layering exists to support diagnosis, not to establish a complex classification scheme in advance.



### 4.2.3 Task Composition and Coverage

When building the initial evaluation suite, there is no need to pursue a large number of tasks immediately. Priority can be given to core behaviors that developers repeatedly inspect manually before launch, failures already observed in real usage, and tasks with high impact[1]. In the early stages, a relatively small, clearly targeted task set is enough to produce useful feedback, and the suite can then expand gradually as new issues emerge during development and real-world use[1][6]. The number of tasks itself is therefore not the objective; the real question is whether the most important current capabilities and risks are represented in the suite.

The evaluation suite also needs to maintain **balanced behavioral coverage**. For the same behavior, there should be cases where the behavior should occur and cases where it should not occur. Covering only one direction causes the evaluation to reward one behavior continuously, which can eventually push the Agent toward over-optimizing in that direction[1][6]. For example, if a suite designed to observe search behavior contains only tasks in which search is expected, the Agent may achieve a higher score simply by searching more often, while creating new problems on questions that do not require search. Keeping tasks on both the positive and negative sides allows the suite to distinguish “correct triggering” from “unconditional triggering”[1].

The **sources of tasks should also be reasonably diverse**. Production data, historical records, domain-expert datasets, and synthetic data can all be included in an evaluation suite[5]. Real data reflects usage patterns that have already occurred, while manually curated and synthetic data can supplement low-frequency but important cases or scenarios that have not yet appeared in production. The concern here is the coverage jointly created by these different sources, rather than how raw data is transformed into a complete evaluation task.

Beyond source diversity, the **scenario distribution** also needs to be checked. An evaluation suite should not remain composed only of simple happy-path tasks. It should also cover representative cases, edge cases, and adversarial cases[5]. Together, these scenarios determine whether the suite can expose system problems under complex inputs and abnormal conditions. Here again, the concern is only whether gaps exist at the collection level; how to design specific edge and adversarial tasks belongs to the task-design scope of Chapter 2.

Coverage is also not fixed once and for all. Agent capabilities, product functionality, and user behavior all change over time, and new failure modes continue to emerge. Real failures found during development and production should gradually be incorporated into the corresponding capability suite, regression suite, or process evaluation suite so that discovered problems continue to be checked in later versions[1][5][6].

Organizing the evaluation suite should therefore ultimately create a complementary relationship: **capability evals show what needs to improve next, regression evals protect capabilities that already exist; end-to-end evals observe whether complete tasks succeed, process evals help locate where failures occur; and task coverage ensures that these suites do not leave important behaviors and risks untested over the long term.** Subsequent experimental comparisons are built on top of these organized evaluation suites.

## 4.3 Experimental Control

A version comparison should change only the Agent under evaluation as much as possible, while keeping other conditions that can affect the result consistent. Only after these variables are controlled can differences between the baseline and candidate scores reasonably be attributed to the change being evaluated[2][7].

Experimental control mainly involves three things: **fixing the comparison conditions, ensuring consistent execution environments, and fully recording every run**. The first two provide comparability, while the experiment records make the results reviewable and traceable.

### 4.3.1 Fixed Configuration

Every experiment used for version comparison needs to fix and record the configuration elements that can affect the results. At minimum, this includes four groups:

- **Task configuration**: dataset version and task identifiers;
- **Agent configuration**: commit version, model, prompts, tools, and runtime parameters;
- **Grading configuration**: grader definitions, scoring rules, and grader versions;
- **Run configuration**: the execution environment and its data, dependency versions, and settings such as the number of trials, concurrency, and timeouts[3][7].

The purpose of fixing these configurations is to ensure that the baseline and candidate face the same tasks, scoring standards, and runtime conditions. Otherwise, score changes may simultaneously contain changes in the tasks, graders, or environment itself, making it impossible to tell whether the difference comes from the Agent or from the experimental conditions.

Dataset versioning is especially important. Evaluation suites continuously add new tasks, modify existing tasks, and archive obsolete items, so the “current dataset” seen at different times may no longer contain the same data. Dataset versions record each addition, modification, deletion, or archive operation and make it possible to retrieve the set of items as it existed at a specified point in time[3].

![Dataset version history. The top indicates that the current view corresponds to a version at a specific point in time and notes that 6 changes have occurred since then; the right side lists 26 versions with their timestamps, while the item list displays both archived and active entries](../images/dataset-version-history.png)

Caption: Every item change creates a new version, and the set of items that existed at a specific point in time can be retrieved by timestamp. Image from [3].

This mechanism solves a very practical problem: the evaluation suite is a living artifact, and the team will continue adding tasks, revising expected results, and archiving outdated items. If two versions are compared using the “current latest” dataset, the two experiments may actually be using different task sets, meaning the score difference also contains changes in the tasks themselves. Recording the version timestamp makes it possible to retrieve the same data, which is what makes historical experiments reproducible[3].

Fixing the dataset version solves only data consistency; it does not remove randomness in Agent outputs. Therefore, there is another hard requirement: the baseline and candidate must use the same dataset version and the same set of grader definitions for direct comparison to be valid[3][7].

### 4.3.2 Execution Environment

The execution environment should resemble production and provide a clean, isolated initial state for every trial[1][2].

The environment is the condition most easily broken. A common failure mode is inconsistency between the evaluation environment and production: downstream APIs may return different data in testing than in production, or the sandbox may not contain the user’s historical files, preventing the Agent from obtaining required context[2]. The danger of this kind of difference is not merely that scores become higher or lower; it causes offline scores and online behavior to diverge systematically. The consequence is more serious than a single bad measurement: over time, the team may stop trusting offline evaluation and fall back on ad hoc judgment[2].

Insufficient isolation creates another kind of risk. Leftover files, cached data, and shared resources can introduce failures unrelated to Agent capability, causing multiple trials that should be independent to fail together because of the same infrastructure problem. They can also artificially inflate the pass rate in the opposite direction[1].

There is a practical way to test environment fidelity: run the same batch of samples once in the offline environment and once under online shadow traffic, then compare whether the two produce consistent conclusions. A large discrepancy indicates insufficient fidelity[2]. This check covers both “does the environment resemble production?” and “is the environment stable?”

After environment data or business rules change, it is necessary to reconfirm that the tasks are still feasible and the graders are still valid, and to record a new environment version[1][2]. The reason environment changes must be treated as versioned events is the same as for datasets: they invalidate the assumptions under which prior conclusions were produced, and that invalidation is silent—the old scores do not turn red on their own.

### 4.3.3 Experiment Records

Experiment records should link at least five kinds of information: the <u>data item</u>, <u>execution record</u>, <u>final state</u>, <u>individual scores</u>, and <u>Agent configuration together with runtime information such as cost and latency</u>. Cost records the resources consumed by one run, while latency records the elapsed time from task start to completion[4][7].

The experiment record should ultimately support a complete traceability path:

> **Aggregate result → specific task → specific trial → execution evidence and grading basis**

If an aggregate score changes, it should be possible to follow this path to the corresponding task and execution record. This means later version comparisons can go beyond observing that “the score changed” and investigate which tasks changed and what execution outcomes caused those changes.

## 4.4 Repeated Trials and Aggregate Metrics

A repeated trial (`Trial`) is one independent execution of the same task under the same configuration[1][2]. The reason it is needed is straightforward: Agent outputs are stochastic, so a single pass or failure is not enough to represent stable task performance.

Before choosing metrics, two questions must be separated. The first is, “If one task is run many times, how should its performance be described?” This is answered by the per-task success rate. The second is, “What single number should summarize the entire evaluation suite?” The difference between `pass@k` and `pass^k` lies here. They are easy to conflate, but they answer opposite questions.

The per-task success rate is the proportion of successful trials among repeated trials of the same task. Its scope is limited to the individual task and is used to identify unstable or particularly difficult tasks. It does not represent the performance level of the entire evaluation suite.

- `pass^1` (equivalent to `pass@1`) looks at whether each task succeeds in a single trial and then aggregates across the evaluation suite. It is used to compare the average level of one-shot task success and serves as the `k = 1` baseline metric. It says nothing about consistency across repeated executions.

- `pass@k` runs each task k times and measures the probability that at least one trial succeeds, then aggregates across tasks. It is appropriate when multiple attempts are allowed and any one usable result is sufficient. As k increases, this metric usually rises because it describes whether “trying a few more times can eventually produce one success”[1].

- `pass^k` runs each task k times and measures the probability that all k trials succeed, then aggregates across tasks. It is appropriate for user-facing tasks that should succeed reliably every time. As k increases, this metric usually decreases because it describes reliability and consistency[1]. Whether the same semantic task remains successful across repeated trials is captured by this metric[8].

Because the two metrics move in opposite directions, **metric choice must follow the product requirement rather than whichever number looks better**. Tasks that allow multiple candidates or retries should focus on `pass@k`, because obtaining one usable result after several attempts may be acceptable; tasks in which a single failure harms the user should focus on `pass^k`, because the user may not give the system a second chance[1][8]. Choosing the wrong metric can reverse the conclusion: a version that looks excellent under `pass@k` may still fall far short of user-facing reliability requirements under `pass^k`.

There is one implementation constraint here. Experiments organized by dataset item usually assume that each data item is run only once, meaning repeated trials are not supported by default[4]. To obtain k trials, the practical approach is to run the same batch of data items for k rounds, or to perform the repetition outside the experiment layer and then aggregate the results by task. The metric calculation itself does not change, but the record structure must distinguish different trials of the same task; otherwise, the number of successes for each task cannot be reconstructed during aggregation.

## 4.5 Version Comparison and Result Review

Version comparison uses an **approved, reviewed release version** as the baseline and the **version under evaluation** as the candidate[7]. Before comparison, it is necessary to confirm that both use the same dataset version, grader definitions, and required task set, and to record the corresponding Agent and grader versions. The reasons these conditions must be fixed have already been discussed above; this section compares results only between experiments that are truly comparable.

Version comparison ultimately produces two layers of judgment: **aggregate metrics answer what changed overall, while case-level review answers why those changes occurred.** Only by combining the two can a score change be interpreted as a real capability improvement or regression rather than a change caused by the experimental conditions or the graders themselves.

### 4.5.1 Aggregate Results

Version comparison begins with overall results such as task pass rate, category-level scores, cost, and latency[7][9]. These aggregate metrics provide a quick view of whether the candidate version improved or degraded overall, but they cannot replace item-by-item inspection.

First, **the same overall score does not mean the same individual tasks behaved the same way**. Averages can cancel out improvements and regressions across different tasks. For example, the baseline and candidate may both have an overall accuracy of 50%, yet item-level comparison may show that the candidate fixed a failure on “refund for promotional items” while regressing on “standard refund policy,” which previously worked correctly[7]. The number of passing tasks is the same on both sides, but the product implications are completely different. Therefore, in addition to overall metrics, it is necessary to inspect which tasks changed from pass to fail and which changed from fail to pass.

Second, check **whether the results are complete**. Missing tasks, failed task executions, and graders that return no result must not be treated as passes[7][9]. All of these mean the experiment result is incomplete; if they are simply ignored during aggregation, the overall metric may be artificially inflated because failure information is missing.

Third, check **whether the scores are trustworthy**. Even when graders return scores, the scoring explanation and the actual output should still be reviewed together to confirm that the score is supported by execution evidence[7]. If a score change is caused by grader malfunction rather than a change in Agent behavior, it cannot be used directly for version decisions.

![Experiment comparison view. The left side lists individual data items and inputs, the middle groups evaluation scores by experiment and shows their increases or decreases relative to the baseline, the right side shows output content, and the final two columns show cost and latency deltas](../images/experiment-comparison.png)

Caption: Item-by-item comparison places score changes, outputs, cost, and latency together so that both newly introduced failures and newly achieved passes are visible. Image from [7].

### 4.5.2 Case-Level Review

Case-level review is used to explain why those changes occurred. The focus should be on newly introduced failures, regressions on critical tasks, and samples with anomalous scoring.

The first step is to open the corresponding execution record and Trace and inspect the input, tool calls, intermediate states, final output, and individual scores[7]. This moves the investigation from the aggregate score back to the original evidence and makes it possible to identify which stage of execution failed.

The second step is to distinguish the nature of the failure. At minimum, three cases should be separated: **Agent execution failure, a problem in the task or environment itself, and grader misclassification**[1][7]. For example, a reasonable paraphrase rejected by string matching may indicate that the grader is too rigid, while a fluent-looking response that contains unsupported claims is still an Agent failure[7]. The purpose of review is to avoid collapsing all of these cases into the same generic “failure” label.

If the problem comes from the task, environment, or grader, the corresponding evaluation condition should be corrected first, and then the affected samples should be rerun. In particular, after a grader is modified, only re-evaluating the candidate version is insufficient; both the baseline and candidate must be rescored with the new grader. Otherwise, the two sides are still being judged under different standards and cannot be compared directly[7].



## 4.6 Release Policy

A release policy (`Release Policy`) is **the rule that maps experimental results into a release or block decision**. It needs to be defined before interpreting the candidate version’s results and should correspond to the importance of different tasks in the evaluation suite[7][9]. If the threshold is decided only after seeing the candidate results, the standard can shift with the performance of the current version.

Release policies are usually built from two basic kinds of rules, which can be combined[9].

- The first is a **hard pass requirement**. Specified critical tasks or critical scores must all meet their requirements; if any one fails, the release is blocked. This is appropriate for safety, compliance, data accuracy, irreversible actions, and other requirements that cannot be offset by high scores elsewhere.

- The second is a **regression requirement**. Tasks that passed in the approved baseline must continue to pass in the candidate version[9]. This protects already validated capabilities, allowing the candidate to add new capabilities without degrading existing ones.

In practice, releases usually use both kinds of rules together and combine them with thresholds on aggregate metrics[9]. For example, critical tasks may be required to pass completely while previously validated capabilities in the approved baseline must show no regression; on top of that, the overall task success rate, cost, or latency may also be required to remain within predefined ranges.

Different metrics can be further stratified by importance. Checks such as safety and data accuracy can be made release-blocking, while experience-related or bonus items can use aggregate thresholds[2]. What changes here is the **release-decision rule**; the scoring method for each individual task remains unchanged.

For a release policy to become part of version management, two supporting mechanisms are also required.

- The first is an **approved baseline**. It records an Agent version that has already been reviewed and accepted, together with the corresponding dataset version, grader version, and task-level conclusions[7][9]. Even if a candidate version passes the current release checks, it should not automatically become the new approved baseline. A new baseline should come from a complete run, be manually reviewed, and then be updated through the normal code-review process[9]. This prevents known failures in a candidate version from being silently absorbed into the baseline. Once a failure becomes implicitly accepted through a baseline update, later version comparisons may stop recognizing it as a newly introduced regression[9].

- The second is **workflow integration**. Only after the release policy is integrated into continuous integration and continuous delivery (`CI/CD`) or the formal release process can offline evaluation run consistently on every change[2][9]. A threshold that is not integrated into the release process is still only a recommendation in practice.

At this point, offline evaluation forms a complete chain: **the evaluation suite defines what to observe, experiments make different versions comparable, version review explains where the changes come from, and the release policy converts those results into an explicit release decision.** Chapter 5 continues with the problems that lie beyond offline evaluation: new behaviors and new failures that emerge after the Agent is deployed in real-world usage.

## References

1. Anthropic. [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). `Capability vs. regression evals`, `How to think about non-determinism in evaluations for agents`, `Step 3: Build balanced problem sets`, `Step 4: Build a robust eval harness with a stable environment`.
2. Meituan Tech Team. [Agent Evaluation White Paper Series 01: An Overview of Agent Evaluation](https://tech.meituan.com/2026/09/10/Agent-Evaluation-White-Paper-01.html). `II. Offline Evaluation: Gating Changes`, `2.1.2 Evaluation Suite Categories: End-to-End and Process`, `2.1.3 Layered Decomposition of Evaluation Suites`, `2.2 Backtesting Execution: Putting the Evaluation Suite to Work`.
3. Langfuse. [Datasets](https://langfuse.com/docs/evaluation/experiments/datasets). `Why use datasets?`, `Versioning`.
4. Langfuse. [Experiments Data Model](https://langfuse.com/docs/evaluation/experiments/data-model). `Objects`, `End to End Data Relations`.
5. OpenAI. [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices?api-mode=responses). `Design your eval process`, `Handle edge cases`.
6. OpenAI. [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills). `4. Use a small, targeted prompt set to catch regressions early`.
7. Langfuse. [Compare experiments](https://langfuse.com/docs/evaluation/experiments/compare-experiments). `Choose comparable runs`, `Inspect scores and outputs`, `Investigate and review failures`, `Turn the decision into a CI policy`.
8. Sierra. [τ-bench: benchmarking AI agents for the real-world](https://sierra.ai/resources/research/tau-bench) (paper: *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains*, arXiv:2406.12045v1). `3 τ-bench`.
9. Langfuse. [Experiments in CI/CD](https://langfuse.com/docs/evaluation/experiments/experiments-ci-cd). `Choose your release policy`, `Compare against an approved baseline`.
