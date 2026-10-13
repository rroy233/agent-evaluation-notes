# Chapter 3 Grader Design

The task specification has already defined what result a task should achieve, what constraints must be followed during execution, and what evidence can be read when checking those requirements. The next question is: **how should that evidence be used to determine whether the task passes.**

A **grader (`Grader`, also called an `Evaluator`)** is the logic that performs this judgment. It reads execution evidence according to predefined scoring rules and produces a result for a particular task requirement[1][4]. A task usually contains several requirements of different kinds—for example, whether the final state is correct, whether key operations follow the rules, and whether the response contains the required information—so multiple graders are typically needed to check them separately[1].

Graders should correspond directly to the requirements and evidence defined in the task specification: every expected result or behavioral constraint that needs to be verified should have matching grading logic, and every piece of evidence used during grading must already have been declared in the task specification. At the same time, the scoring rules should be explicit enough that different reviewers or different grading methods can reach conclusions that are as consistent as possible when given the same evidence. Agreement among human reviewers, and between humans and automated graders, will be examined further during calibration[13].

This chapter ultimately organizes these elements into a grader specification that can be used to compare different Agent versions consistently under the same standards.

## 3.1 Grading Targets and Results

Before designing a grader, two basic questions need to be answered: **what evidence it will inspect, and what result it will output after inspection.**

### 3.1.1 Grading Targets

A grading target refers to **the evidence that the grader actually reads and evaluates**[1].

Based on the information produced during an Agent execution, common grading targets include:

- **Final state** is suitable for verifying outcomes that can be checked directly, such as whether an order state changed, whether the correct record was written to a database, whether a file was generated, or whether tests passed. A typical example is verifying that an order was actually written to the backend instead of judging solely from the Agent's statement that "the operation succeeded"[1].

- **Execution trace** is suitable for checking process behavior that cannot be inferred directly from the final state, such as which tools the Agent used, whether any unauthorized operation occurred, whether required information was collected, and whether key decisions complied with the requirements. Depending on the scoring item, the grader may inspect the entire execution process or only one specific operation within it.

- **Final response to the user** is mainly used to check what information the user ultimately received, such as whether required information is complete, whether the outcome is clearly explained, and whether the response satisfies the relevant communication requirements.

A task can define separate graders for different grading targets, and the same evidence may also be used by multiple graders. This creates a corresponding requirement for task design: before adding a new check, first confirm that the execution will produce evidence capable of supporting that judgment. A requirement without corresponding evidence cannot actually be verified by a grader[1][3].

### 3.1.2 Grading Results

A grading result (`Score`) is **the result record produced by a grader for a particular check**. It usually contains a result name, value, and data type, and may also include an explanation or grading rationale[6].

There are four common result forms: <u>text, boolean, categorical, and numeric</u>. When choosing a result form, two questions matter most: **whether the result needs to participate directly in aggregation, and whether the judgment itself is discrete or continuous.**

Text is appropriate for recording open-ended review comments, issue descriptions, and grading rationales. It can preserve information that is difficult to quantify directly and can also help derive new scoring items from human review. Because free-form text is difficult to aggregate directly, it is generally not used to calculate overall pass rates or compare version scores[6].

Conditions that can be answered clearly as "yes / no" are well suited to **boolean results**, such as "does the output contain prohibited content?" or "is the format valid?"; when there is a limited set of predefined states, **categorical results** can be used, such as "correct / partially correct / incorrect"; when the judgment needs to express a continuous degree, **numeric results** are appropriate, such as relevance or accuracy.

Numeric scoring in particular requires the value range, the direction in which higher values indicate better or worse quality, and the quality level corresponding to each interval to be defined in advance. Otherwise, the same score may be interpreted differently by different reviewers. For conditions that can be clearly judged as pass or fail, boolean results are usually preferable because they make consistency easier to maintain[12].

To make grading results traceable, each result also needs to be linked to the execution object it evaluates. For example, it may correspond to a complete end-to-end execution, one specific operation within it, or an entire multi-turn conversation[7]. This makes it possible to trace any score back to the original evidence that produced it.

![Human scoring panel. Three scoring items are shown side by side on the same execution record: Helpfulness uses a numeric score and is set to 2; Hallucination uses a boolean score and is set to False; Positive uses a boolean score and is set to True. Each scoring item has an adjacent comment entry](../images/score-types-annotation-panel.png)
Caption: Multiple scoring items can be attached to the same execution record. Each item can use the result form most appropriate for it and can include additional text comments. Image from [9].

For long-term use, the basic definition of the same scoring item also needs to remain fixed. The score configuration records the score name, data type, and allowed value range so that the same score remains consistent across different tasks and evaluation batches[7]. Otherwise, if a score with the same name uses different ranges or meanings in different batches, direct version comparison becomes impossible.

Each scoring result can also record its source, such as whether it was written through a programmatic interface, generated by an automated grader, or provided by a human reviewer[7]. Source information allows later analysis to distinguish how different results were produced and provides a basis for comparing human and automated judgments.

At this point, what a grader checks and what it ultimately outputs have been defined. A task will usually use multiple graders at the same time. How those multiple results are ultimately combined into a task-level pass or fail conclusion will be discussed later under scoring rules.

## 3.2 Evaluation Method Framework

Producing grading results from execution evidence requires solving three levels of problems:

- **Grading mechanism**: who makes the judgment and by what method;
- **Grading reference**: what standard the judgment is based on;
- **Score recording and collaboration**: how results are stored, and how humans and automated systems jointly use them.

Separating these three allows the same scoring rule to remain independent of any one implementation. For example, "whether user confirmation was obtained before issuing a refund" can be checked by code, handed to an LLM, or judged by a human, while the rule itself remains unchanged.

### 3.2.1 Grading Mechanisms

A grading mechanism is **the actor and logic that directly produce the grading result**. Different mechanisms mainly differ in what types of judgments they can handle, whether they can provide explanations, and their execution cost.

(1) **Code-based grading** uses deterministic program rules to inspect evidence[3]. It is suitable for facts that can be verified directly, such as whether a string or field matches, whether the output format is valid, whether a particular tool was called, whether parameters were correct, whether the database state satisfies requirements, and whether tests passed. These judgments are stable, reproducible, and relatively easy to debug. Their limitation is that the checking rules must be specified in advance; if the condition is too rigid—for example, requiring fixed wording or requiring the Agent to follow a particular tool sequence that is not actually necessary—it may incorrectly classify an otherwise valid result as a failure[1].

(2) **Large language model grading (`LLM-as-a-Judge`, hereafter LLM grading)** uses a language model to make judgments based on the provided evidence and scoring rules, and can generate a grading rationale at the same time[4]. It is suitable for open-ended semantic requirements that are difficult to determine directly in code, such as whether an answer is complete, whether its supporting evidence is sufficient, whether the communication style is appropriate, or whether decisions made during execution are reasonable. LLM grading can interpret complex natural-language requirements and provide reasons, but its results can be affected by output length, candidate ordering, the judge model, and the prompt[11][12]. Therefore, it must be calibrated against human-labeled reference samples before formal use. The specific method is discussed in Section 3.5.

![Configuration of an LLM grader. The left side contains the judging rules, specifying the role, grading task, and input template; the template references the system prompt and the last user message using double curly braces. Below, the result is constrained to true or false. The right side shows a trial run on a sample: the result is false, together with the model rationale, a probability of 0.97, and the cost of this judgment](../images/llm-judge-evaluator-setup.png)

Caption: A large language model grader consists of three parts: judging rules, input mapping, and result format. After configuration, it should first be trial-run on samples before being used in formal evaluation. Image from [4].

(3) **Jev grading** (`Jev-as-a-Judge`) also uses a model to make judgments, but does not require the model to freely generate a scoring response. Before the call, typed questions and allowed answers are defined; the model then selects among those answers based on the provided state and returns the corresponding probabilities[5].

For example, the following question and candidate answers can be defined in advance:

> Was explicit user confirmation obtained before the refund?  
> `Yes / No / Unknown`

This approach constrains the answer space to a predefined range, reducing variation caused by output formatting and wording. A single call can also answer multiple typed questions, making it suitable for large-scale classification, ordinal, and yes/no judgments[5]. It is still a model-based judgment: the question definition, input state, and candidate categories all affect the result. Jev itself cannot proactively abstain, so if there are realistic cases where a judgment cannot be made, options such as "Other" or "Unknown" need to be defined in advance. The state provided to the model should also contain only information relevant to the current judgment in order to reduce interference from irrelevant material[5].

(4) **Human review** is performed by domain experts who directly inspect the execution evidence according to the scoring rules and provide judgments and comments[8]. Humans can handle complex business semantics and expert judgment, and they can also provide reference labels for automated graders. The main limitations are speed, cost, and the possibility of disagreement between reviewers. Human review is therefore mainly used for higher-risk tasks that are difficult to fully automate, cases where the scoring rules are not yet stable, and the creation of reference labels and calibration data for automated graders[8][12].

### 3.2.2 Grading References

A grading reference is **the standard against which the grader compares the evidence**. It is independent of the grading mechanism: the same reference can be executed by different mechanisms. For example, the same refund policy can be implemented as code or checked by an LLM or a human reviewer.

(1) The first type is a **scoring rubric** (`Rubric`).

A rubric explicitly states the conditions under which a result passes, fails, or reaches a particular level. It is suitable when there is no single canonical answer or when a task needs to check multiple requirements at once.

The rules should be as explicit as possible. Requirements such as "the answer is good" or "the handling is reasonable" are too broad and can easily be interpreted differently by different people or models. A better approach is to decompose them into concrete checks, such as "does the response state the refund amount?" and "does it explain the next step?"

(2) The second type is a **reference answer**.

This approach compares the actual result against a prepared correct answer or expected outcome[11]. It provides a clear judgment anchor and is appropriate for tasks with relatively well-defined answers or target states.

If a task actually allows multiple equally valid responses or execution paths, a single reference answer may not cover all reasonable outcomes. The reference answer therefore needs to match the openness of the task itself.

(3) The third type is **pairwise comparison**.

Pairwise comparison does not require assigning an absolute score to one result. Instead, two candidate results are evaluated side by side under the same criteria to determine which better satisfies the requirements[11].

This approach is suitable for comparing two Agent versions or two approaches. When the main goal is relative quality comparison, it is often easier to keep stable than asking a model to produce an open-ended absolute score directly[11][12].

Pairwise comparison produces a relative conclusion. It can show whether A or B better satisfies the rubric, but on its own it cannot prove that either one has reached the threshold required for production release.

These three reference types are not mutually exclusive. For example, a rubric can be defined while also providing a reference answer as supporting guidance. Jev's typed questions can also be viewed as a strongly constrained form of rubric—the candidate answers and levels are determined before the call, and the model's role is to select among them[4][5].

### 3.2.3 Score Recording and Collaboration

After grading results are produced, results from different sources still need to be recorded in a unified way on their corresponding execution objects so that they can be traced, compared, and used for later analysis.

Human scores can be assigned directly to a small number of samples or completed in batches through annotation queues. **Manual scoring** is appropriate for quick review of small sample sets, investigation of individual issues, and creating initial human reference results[9]. As the number of samples grows, **annotation queues** can be used to collect a batch of execution records and have domain experts label them in bulk under the same scoring criteria[8].

Another class of results comes from automated programs or external systems. If a score has already been computed by an application, continuous integration pipeline, or another evaluation process, it can be written into the evaluation system through an `API` or software development kit (`SDK`)[10]. The `API` or `SDK` only records a result that has already been produced; it does not define how that score should be calculated.

Whether results come from humans or automated systems, they should use consistent score definitions, including the score name, data type, and allowed values, and should be linked to the corresponding execution record. Only then can results under the same scoring item be compared directly, and each score can be traced back to who produced it and by what method.

Unified recording also provides the foundation for later calibration. For example, humans and automated graders can score the same set of samples independently, after which their disagreements can be examined. How to measure agreement, locate bias, and adjust graders is discussed in Section 3.5.

## 3.3 Method Selection and Combination

Method selection should work **backward from the success criteria, evidence type, and required result**. Different mechanisms have different boundaries of applicability and can be selected in the following order.

1. Conditions that can be verified directly from environment state, tool parameters, or test results should preferentially use code-based grading. These conditions can be expressed as deterministic rules, producing stable and reproducible results.

2. When candidate labels, levels, or yes/no outcomes are predefined and the sample size is large, Jev grading can be used. Typed questions can answer multiple judgments in a single call and can also return probabilities that support later threshold setting.

3. When judging completeness, quality of evidence, or communication quality, and when a written rationale is desired, LLM grading can be used. It is suitable for open-ended semantic conditions but must be calibrated against human labels before formal use.

4. When a judgment depends on expert knowledge, carries high risk, or automated grading has not yet been stably aligned with domain judgment, human review should be retained. Human labels provide both domain reference points and calibration data for automated graders.

5. If a score has already been computed by an application, pipeline, or continuous integration (`CI`) job, it can be written into the same scoring record through an `API` or `SDK` and analyzed together with other results.

When a task uses multiple graders, responsibilities can be divided according to the conditions and evidence types: verifiable facts go to code-based grading, typed judgments go to Jev, open-ended semantic quality goes to an LLM, and human review establishes reference labels for high-value or high-risk samples[1][5][8]. One common combination is: **run lower-cost typed judgments on all samples first, then supplement a subset of samples or flagged samples with LLM grading, while using human labels to verify whether the automated grading results are trustworthy**[5]. This concentrates human review on calibration, difficult samples, and high-risk tasks rather than requiring humans to judge every sample.

## 3.4 Scoring Rules

A scoring rubric (`Rubric`) is **a set of checks that explicitly state the basis for judgment**. Its purpose is to turn abstract success criteria into facts or standards that can actually be evaluated[13][1].

### 3.4.1 Scoring Items

A scoring item should be responsible for only **one** fact or **one** judgment, such as whether identity verification was completed or whether the refund amount was stated[1]. When writing a scoring item, four things need to be specified: what is being judged, which evidence is inspected, what counts as a pass, and what counts as a failure.

When the evidence is insufficient, the scoring item should return **Unknown**. Unknown means that the available material is insufficient to determine either pass or fail; it is a different result from failure[1]. Retaining an "Unknown" outcome also has a practical benefit: it can be used to inspect the design of the rules and evidence. A high Unknown rate usually indicates that the scoring rule is unclear or that evidence collection is incomplete[13].

Open-ended quality requirements need to be further **decomposed into concrete scoring items**. For example, "is this answer good?" can be broken down into a set of questions that can each be judged independently. This turns an originally vague overall impression into clearer factual evidence and makes disagreements between people, or between people and automated graders, easier to locate[13]. Scoring items can use boolean, categorical, or numeric results. The clearer the scoring granularity, the easier it is for human review and automated grading to produce comparable conclusions[13][1].

### 3.4.2 Task-Level Conclusion

A task usually contains multiple scoring items, and any one scoring item can only show whether one particular requirement was satisfied. These results therefore need to be further combined into a **task-level conclusion** that indicates whether the complete execution succeeded overall.

Before combining them, first distinguish the relationship among the scoring items: are they describing **different aspects of the same goal**, or do they represent **separate requirements that must each be satisfied**?

- If multiple scoring items jointly describe the same quality goal, they can be combined to measure overall quality. For example, a report can be scored separately for coverage, accuracy, and structure, then combined according to the importance of each item.

- If the scoring items represent independent requirements, it is necessary to determine whether any of them are hard requirements that cannot be offset by other scores. For example, in a refund task, "was the refund completed?" and "was identity verification completed?" correspond to task completion and a safety requirement, respectively. If identity verification fails, a high score on other items should not be allowed to compensate for that failure through weighting.

Based on these relationships, task-level conclusions usually use one of three aggregation methods: **hard-gate rules, weighted rules, and hybrid rules**[1].

- **Hard Gate** requires all critical scoring items to pass. If any one of them fails, the entire task is judged as failed. It is suitable for safety, compliance, access control, irreversible operations, and other hard requirements.
- **Weighted Score** assigns weights to different scoring items and produces the task-level conclusion based on whether the aggregate score reaches a threshold. It is suitable when multiple scoring items jointly describe one quality goal or when the task allows different degrees of completion.
- **Hybrid** combines the first two approaches. For example, all permission- and safety-related scoring items must pass first, after which completeness, efficiency, and other metrics are combined into an overall quality score.

Even if the final task-level result is only "pass" or "fail," meaningful partial scores should still be retained. An Agent that correctly identifies the issue and verifies the customer's identity but fails to complete the refund is clearly better than an Agent that fails from the beginning, and their results should be distinguishable[1]. The task-level conclusion therefore indicates whether the overall task succeeded, while the individual scoring items and partial scores further explain how far the task progressed and where the failure occurred.

The task-level conclusion must also remain traceable to the scoring items and corresponding evidence involved in the aggregation. This way, when an execution is judged as failed, it is possible to identify exactly which requirement was not satisfied instead of receiving only an unexplained failure result.

The scoring rules themselves also affect the final task-level conclusion, so the design should prioritize the task outcome and process requirements that genuinely matter. Tool-call order should be included in the scoring rules only when the order of steps itself affects correctness or safety[1]. If one fixed tool-call sequence is treated as a requirement, an Agent that follows another equally valid path may still be misclassified as a failure, making the evaluation overly sensitive to reasonable execution variation[1].

Scoring rules themselves can also be misconfigured. One case is when the grader effectively requires a higher threshold than the task explicitly specifies, causing an Agent that correctly satisfies the task to lose points while an Agent that does not strictly follow the stated target may score higher[1]. Another case is an overly rigid condition: for example, the task result already satisfies `96.12`, but the grader requires an exact match to `96.124991…`, causing a reasonable result to be judged as a failure[1]. Therefore, whether a task-level conclusion is trustworthy depends not only on the Agent's execution result, but also on whether the scoring rules accurately reflect the task's actual requirements.

## 3.5 Calibration and Validation

Calibration and validation focus on two different questions. **Calibration** uses human-labeled reference samples to check whether automated grading results consistently align with domain-expert judgment; **validation** checks whether the grader is actually measuring the conditions declared in the task specification rather than treating irrelevant factors as evidence. The former asks "are the judgments consistent?" while the latter asks "is the grader judging the right thing?" Together, they determine whether the grading results are trustworthy[12][8].

### 3.5.1 Reference Annotations

Reference annotations are judgments, together with the reasons behind them, provided by domain experts for a representative set of executions[8]. They serve two main purposes: first, to measure agreement among different human reviewers; second, to measure the gap between LLM grading and domain judgment[13][12].

The reference sample set should cover four cases: pass, fail, partial completion, and insufficient evidence. If the sample set covers only one outcome, it is impossible to know whether the scoring rules and automated graders remain valid under the other conditions.

Multiple reviewers must use the same scoring rules and annotate independently in a blind fashion, meaning later reviewers cannot see earlier reviewers' conclusions. When disagreements occur, they can be addressed in three ways: revise the scoring item, add examples, or make the evidence requirements more explicit[13]. Disagreement itself is a useful signal because it usually indicates that some part of the rule is still underspecified.

In addition to agreement among reviewers, the proportion of **"Unknown" results** can also be monitored. "Unknown" is not only a grading outcome; it also reflects the quality of the scoring rules and evidence design. A high Unknown rate usually indicates that the scoring items are not clear enough or that evidence collection is incomplete[13].

The rules should be revised continuously using these disagreements and Unknown cases until agreement on individual scoring items reaches a predefined threshold. Only then can the rules be considered stable. For example, human-human agreement might be set to 85% and human-machine agreement to 90%[13]. The actual thresholds need to be fixed before the evaluation begins to avoid retroactively adjusting the standard based on already observed results.

### 3.5.2 Grader Validation

Once reference annotations are available, automated grading results can be compared against the reference results on representative samples. The checks can be divided into four layers, each answering a different question: **is the grader functioning correctly, do its results agree with human judgments, is it using the right evidence, and are its results affected by systematic bias?**

The first layer checks **whether the grader produces results correctly**. A grader error or missing return value is itself a failure and must not be skipped as if it meant "no issue"[7]. This is especially easy to overlook during batch execution because it often appears as a missing score rather than a low score.

The second layer checks **agreement between automated grading and reference annotations**. LLM grading is suitable for broader use only when it reaches sufficient agreement with expert conclusions[12][4]. Calibration can begin with roughly 20 labeled samples and then gradually expand, reducing the chance that a small sample size allows individual cases to dominate the calibration result[12].

It is also important to note that agreement rates from general-purpose benchmarks cannot substitute directly for calibration results in a specific business domain. Agreement between language-model judges and humans can exceed 80% on some general benchmarks, approaching the level of agreement among human annotators themselves; however, in domain-specific Agent tasks, that level may drop significantly. Calibration must therefore use reference samples from the actual business domain rather than directly adopting numbers from general benchmarks[12].

The third layer checks **whether the basis of judgment is correct**. In addition to comparing the final result, the grading rationale and corresponding execution trace should be examined to confirm that the grader is actually using the evidence required by the scoring rules. This primarily prevents the grader from taking shortcuts based on features unrelated to actual quality, such as output length or formatting[11][12]. Such problems may not significantly reduce overall agreement but can still cause persistent errors on specific categories or boundary cases.

The fourth layer checks **systematic bias**. LLM grading is known to be influenced by several factors: output length can affect scores, candidate ordering can affect selection, and prompt rephrasing can change the final judgment[11][12]. In addition, assigning multiple requirements to a single grader may cause interference among scoring items. A more robust approach is to decompose the requirements into structured scoring items and judge them separately[1].

Therefore, the focus of this layer is not whether one particular sample was graded incorrectly, but whether the results change systematically with **length, order, prompt wording, or the way scoring items are grouped**.

Jev grading requires three additional checks: whether the questions are atomic, meaning each question contains only one judgment; whether the input state contains only the evidence required for that judgment; and whether the answer categories provide an escape such as "Unknown"[5]. The first two constrain the design of the question and input state respectively, while the third prevents the model from being forced to choose among existing answers when the evidence is insufficient. Excessive state information unrelated to the question can also reduce grading accuracy[5].

Completing initial calibration does not mean a grader can remain unchanged indefinitely. Judge models may drift across versions, causing the same evidence to receive different judgments at different times. Reference samples therefore need to be re-run periodically for recalibration[12][5]. This drift may not always appear as a sudden score shift; it may instead take the form of gradually looser or stricter judgment standards.

The grader itself should therefore be continuously managed as part of the evaluation system. Whenever the Agent, business rules, or judge model changes, the reference samples need to be re-run[12][5]. Changes to the grader itself introduce another issue: results produced by the new grader cannot be compared directly with historical results produced by the old grader. In that case, historical samples need to be re-evaluated with the new grader so that version comparison is once again based on the same scoring standard[7]. Otherwise, the team may mistake score differences caused by a grader change for changes in the Agent itself.

## 3.6 Grader Specification

The preceding design should ultimately be consolidated into a reviewable and reusable **grader specification**. This specification records how a grader reads evidence, what rules it applies, and how its result contributes to the final task-level conclusion.

The specification can be filled out in the same order as the design above. First, clearly state the **grading target and evidence source**, explaining what the grader actually inspects; then specify the **grading mechanism** and **grading reference**, and include the concrete artifact that performs the judgment, such as checking code, a prompt, typed questions, or instructions provided to human reviewers.

Next, record **how scoring results are produced and stored**, including the scoring items, the result form used by each item, and how humans or automated systems participate. When a task contains multiple scoring items, the specification also needs to state how those results are combined into the final task-level conclusion.

Finally, record the **reference annotations, calibration results, and known limitations**. These show what validation the current grader has undergone and under what conditions it may still produce unreliable judgments.

This specification must also remain aligned with the task specification. Every expected result and behavioral constraint declared in the task specification should have a corresponding grader responsible for checking it; every piece of evidence used by a grader should likewise already be declared in the task specification. This creates a traceable chain from task requirement to grading logic to final result.

**Known limitations must not be omitted.** Even after calibration, a grader is not equally reliable on every sample. Recording the situations in which it is prone to error and the extent to which it has been calibrated makes it possible to distinguish later between changes in the Agent itself and noise introduced by the grader.



The specification described above can be represented with the following table template:

| Field | Content |
| -------------------- | ------------------------------------------- |
| **Grader name** | Unique name, for example `refund_confirmation_grader` |
| **Corresponding task requirement** | The expected result or behavioral constraint verified by this grader |
| **Grading target** | Final state / execution trace / final response |
| **Evidence source** | The actual fields, state, Trace, or response content read by the grader |
| **Grading mechanism** | Code-based grading / LLM grading / Jev grading / human review |
| **Grading reference** | Rubric / reference answer / pairwise comparison |
| **Scoring item** | The specific fact or condition to be judged |
| **Result form** | Boolean / Category / Numeric / Text |
| **Pass condition** | The condition under which the scoring item is judged as passing |
| **Unknown condition** | The conditions under which evidence is insufficient and `Unknown` is returned |
| **Role in task-level conclusion** | Hard-gate item / weighted item / diagnostic item, together with the corresponding weight |
| **Reference annotations** | Human-labeled samples used for calibration and their source |
| **Calibration results** | Validation results such as human-human agreement and human-machine agreement |
| **Known limitations** | Known biases, common misclassification cases, or scope of applicability |
| **Version** | Version of the grader or scoring rules |



## References

1. Anthropic. [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). `Types of graders for agents`, `Evaluating coding agents`, `Step 2: Write unambiguous tasks with reference solutions`, `Step 5: Design graders thoughtfully`.
2. Langfuse. [Core Concepts](https://langfuse.com/docs/evaluation/core-concepts). `Evaluation Methods`.
3. Langfuse. [Code evaluators](https://langfuse.com/docs/evaluation/evaluation-methods/code-evaluators).
4. Langfuse. [LLM-as-a-Judge](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge).
5. Langfuse. [Jev as a judge](https://langfuse.com/docs/evaluation/evaluation-methods/jev-as-a-judge).
6. Langfuse. [Scores](https://langfuse.com/docs/evaluation/scores/overview).
7. Langfuse. [Scores Data Model](https://langfuse.com/docs/evaluation/scores/data-model).
8. Langfuse. [Annotation Queues](https://langfuse.com/docs/evaluation/evaluation-methods/annotation-queues).
9. Langfuse. [Scores via UI](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-ui).
10. Langfuse. [Scores via API/SDK](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-sdk).
11. OpenAI. [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices?api-mode=responses). `LLM-as-a-judge and model graders`.
12. LangChain. [Evaluating AI Agents at the Run, Trace, and Thread Level](https://www.langchain.com/resources/agent-evals). `Calibrating the judges`, `Human review that scales`.
13. Meituan Tech Team. [Agent Evaluation: A Practical Guide from Fundamentals to Advanced Practice](https://tech.meituan.com/2026/08/07/Agent-Evaluation.html). `2.3 Aligning subjective evaluation with human-human and human-machine agreement`, `2.4 Agent evaluation is an empirical discipline`.
