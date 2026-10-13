# Chapter 5 Production Feedback and Evaluation-Suite Evolution

An offline evaluation suite can cover only the scenarios that have already been written into it; tasks that are absent from the suite can never be discovered through backtesting[2]. When users begin to concentrate on a new category of requests, the offline suite will not automatically grow corresponding tasks, yet these new requests are often the first weaknesses exposed as an Agent moves toward large-scale deployment. Production is therefore more than a validation environment; it is a primary source of evaluation tasks.

The complete transformation pipeline from production records to evaluation tasks has four steps: first, observe online quality; then select samples from production records, confirm whether they represent real problems and identify their causes; next, rewrite valid cases into offline tasks that can run independently and be judged repeatedly; finally, maintain the continuously growing task collection. Once this pipeline is working, tasks, graders, and experiments are no longer one-off checks but part of a continuously updating loop.

## 5.1 Online Quality Observation

Online quality observation is the ongoing collection of quality and operational signals from production execution records. It consists of three methods. All three operate on the same set of records, but they observe different layers.

Online evaluation applies graders to execution records generated in real time. It asks **how well the system is working**, with primary signals including quality, safety, behavioral reasonableness, and newly emerging failure modes. Online monitoring focuses on runtime metrics and asks **whether the system is operating normally**, with primary signals including tool-call success rate, failure rate, timeout rate, Token consumption, and task-type distribution.

The two layers must be examined separately because a healthy result at one layer does not imply a healthy result at the other. Tool calls may succeed 100% of the time while returning incorrect data every time; monitoring is green, but evaluation is red[2]. The reverse is also possible: output quality may appear unchanged while timeout rates have doubled and costs are spiraling out of control.

Online-monitoring metrics fall into three categories, each with a different purpose. Availability metrics include tool-call success rate, failure rate, and timeout rate; cost metrics include Token consumption, average steps per task, and average latency; behavioral-monitoring metrics include task-type distribution, tool-call frequency distribution, and average dialogue turns[2]. The third category is the easiest to underestimate. It captures changes in the user mix rather than isolated anomalies. If the share of a new task category rises rapidly, this usually means that the evaluation suite’s coverage has fallen behind real demand and needs to be expanded[2].

The three categories of metrics need to be interpreted together to produce meaningful conclusions. Suppose task completion rate drops by five percentage points. If the failure rate of a particular tool call simultaneously rises from 2% to 15%, the likely conclusion is an engineering problem. If all tool metrics remain normal but the share of a new task category rises from 10% to 35%, the conclusion is that the user mix has changed and the Agent lacks capability in the new scenario. The responses are completely different: fix the tool in the first case; expand the evaluation suite and improve capability in the second[2].

Periodic inspection sits at the intersection of online evaluation and online monitoring. Its role is to turn online quality observation into a traceable process. A common approach is to sample a representative set of tasks from the offline evaluation suite and run them periodically against the production Agent; as evaluation becomes more refined, a dedicated inspection suite can also be maintained separately[2]. It produces two kinds of outputs at the same time: as a quality judgment, it checks whether a capability remains stable, such as whether the success rate of critical tasks falls below expectations; as a signal-generation mechanism, it records score changes, failed samples, and anomalous trends for subsequent case analysis[2].

Online evaluation has one inherent limitation: it usually does not have access to the complete reference answer that exists in offline tasks. This defines its capability boundary. It is suitable for detecting quality patterns, risks, and drift, but it cannot independently prove that every output is factually correct[1][2]. This limitation also explains why online findings must ultimately be formalized offline: only after reference answers and judging rules are added in an offline environment can a one-time online observation become evidence that can be verified repeatedly.

## 5.2 Production Sample Collection

A production case (`Case`) is a sample selected from real execution records for review and subsequent evaluation. For a case to be usable, it must preserve complete situational information: original input, output, execution record, environment or version identifiers, and any user feedback or automated scores already produced[3][4]. A case without environment information cannot be reconstructed; a case without version identifiers cannot be tied to a specific Agent version.

### 5.2.1 Collection Sources

Cases come from four sources. Their difference lies not in volume, but in their **blind spots**[2]. This is why the four routes cannot substitute for one another.

User feedback provides the strongest signal and is closest to the user’s real experience because it is explicitly expressed by the user. Its blind spot is that only users dissatisfied enough to submit feedback will speak up, so the sample size is small and biased[2].

Automated judging and alerts surface samples from low scores, rule violations, quality degradation, and anomalous trends. They are highly automated and timely, but they can only detect risks that have already been represented by graders or metrics—in other words, “quantifiable anomalies”[2].

Business-rule filtering selects samples according to high-risk or high-value conditions, such as all tasks involving money, coupon configuration, or bulk modification. It is precise and targets already recognized risk areas, but its coverage is therefore limited by the business team’s existing understanding of risk[2].

Random sampling draws randomly from real production requests and inspects how the Agent behaves under natural traffic. It is unbiased and is the only way to discover “problems we never thought of at all.” Its tradeoff is the highest cost and the lowest hit rate[2].

The relationship among the four routes can be summarized in one sentence: feedback, monitoring, and rule-based filtering each see only the problems on their own side, while random sampling covers everything else. Random sampling is the most expensive and least efficient, so it is the easiest to cut—but it is precisely the one that cannot be omitted. Without it, the team is left repeatedly rediscovering only known problems[2].

### 5.2.2 Sampling Rules

Sampling rules define which production execution records enter review. A rule needs to specify four things clearly: the target population, filtering conditions, sampling rate, and which graders and human-review conditions are attached[3][5]. This rule simultaneously determines the coverage, cost, and interpretability of online evaluation, so it is itself a design artifact that needs review.

There are two important tradeoffs in the rule.

The first is to connect monitoring signals with collection. One concrete approach is: when monitoring shows a deviation signal, such as a sudden increase in the failure rate of a particular tool call, pull that batch of failed records into the case pool[2]. The reason is that the signal has already identified the abnormal location, making the sampling cost much lower than blind sampling while also ensuring that random sampling does not miss high-risk scenarios.

The second is the sampling rate. Calling language-model graders costs money. If the rate is too high, cost becomes uncontrollable; if it is too low, problems are missed. A practical approach is to first examine the actual number of rule matches over a recent period and then adjust the sampling rate based on the estimated call cost[3]. The order matters: measure the hit volume first, then set the rate. Doing it in reverse amounts to guessing.

## 5.3 Case Confirmation and Attribution

Collected samples do not yet prove anything. A production case must first be judged as good or bad, and then the source of the problem must be identified. Only after both steps are complete can the case be routed to the appropriate destination[1][2].

### 5.3.1 Good Cases and Bad Cases

A positive case (`Good Case`) is a production sample that meets the expected quality standard and records acceptable results and behavior. A negative case (`Bad Case`) is a production sample that violates success criteria, exposes risk, or triggers negative user feedback[6][2].

The two types of cases serve asymmetric purposes. The value of negative cases is the most direct: they readily expose capability boundaries and system weaknesses. The logic is simple—every mistake that has happened once should not happen a second time[2][6]. The value of positive cases is more often underestimated. A negative case only shows what is unacceptable; it does not show what level counts as acceptable. Without a collection of positive samples, quality discussions become subjective, whereas with them, “this is the level we want” becomes something concrete that the team can point to[2].

Negative cases are more fine-grained than simply “the answer was wrong.” They usually form a set of recognizable failure modes. Some concrete examples are listed below[4].

- Treating management narrative as an official metric even though the structured export does not support it.
- Reporting an unverified metric as a financially confirmed number.
- Collapsing parent-company concentration into a weaker legal-entity-level definition.
- Claiming a more complete compliance status when the evidence supports only one specific type of compliance conclusion.
- Producing a polished answer while failing to provide the required citations, risk list, or supporting evidence.

These failures share a common property: they look complete on the surface but contain internal gaps that are difficult to detect from the final response alone.

Human review should prioritize three kinds of cases: high-risk cases, cases with explicit user complaints, and cases where automated judging is uncertain[1][5]. Review outputs have two uses and should not be reduced to only one: corrected outputs can serve as reference labels, while reviewer comments can be used to calibrate automated graders[1][5]. Using review only to assign scores wastes the information that is most valuable for improving automated judging quality.

### 5.3.2 Attribution Scope

The goal of attribution is to move from “something went wrong here” to “why did it go wrong?” A negative case by itself only indicates that something is wrong somewhere. The method is to lay out the Agent’s execution process and locate the failure point step by step along the execution record. This is highly similar to debugging software by inspecting logs, so it depends heavily on observability infrastructure; incomplete execution records make attribution impossible. This step can be performed manually or assisted by machines[2].

Attribution should first identify which layer the problem belongs to. In execution order, it can be divided into six layers, each with different typical symptoms, fixes, and owners[2].

| Layer | Typical Symptom | Remediation | Owner |
| --- | --- | --- | --- |
| Intent understanding | The user asks for month-over-month comparison, but the Agent performs year-over-year comparison | Adjust prompts, add examples, revise clarification strategy | Agent engineering |
| Planning and routing | Two tools should be called, but only one is used; step order is reversed | Improve task decomposition, correct tool descriptions | Agent engineering |
| Tool execution | Incorrect tool parameters; failure to parse returned data | Fix tool implementation, add parameter validation | Tool developer |
| Context and memory | After a long task, the Agent forgets the user’s original constraints | Improve context-compression strategy, introduce structured state | Agent engineering |
| Knowledge and data | Metric definitions are misunderstood; outdated documents are retrieved | Update the knowledge base, correct retrieval strategy | Knowledge operations |
| Foundation-model capability | Complex reasoning is genuinely incorrect, and the problem disappears after switching models | Upgrade the model, simplify the task, introduce expert knowledge | Algorithm team |

There are two important points in this layered table. First, the six layers correspond to six different owners. Accurate attribution is necessary to route the problem to the right person; otherwise, the team first has to hold a meeting to discuss “whose problem is this?”[2]. Second, only the last layer is truly a foundation-model capability issue. The first five are not. Treating problems in the first five layers as “the model is not good enough” most commonly leads the team to wait for a model upgrade that does not actually solve the problem.

The attribution conclusion may also point back to the evaluation system itself[2]. If a team assumes that “the evaluation says it is bad, therefore the Agent is bad,” a subtle problem emerges: the Agent may be optimized to satisfy the evaluation standard rather than solve the user’s problem. When the evaluation standard itself is biased, harder optimization only pushes the system further from real needs. Attribution should therefore answer two questions at the same time: does the problem actually exist, and do the current scoring rules accurately represent the real risk?

One failure mode only becomes visible at scale and needs to be handled separately. Large numbers of users may repeatedly hit the same outdated guardrail, but those execution records are scattered across thousands of otherwise unrelated records, making the pattern impossible to recognize through manual inspection alone. Once similar execution records are clustered together, the same issue becomes a recognizable pattern that the team can identify and fix; without such aggregation, the failure mode remains buried in production data[5]. This also shows that case mining cannot rely only on judging the value of individual cases; it also needs a mechanism for grouping scattered cases into patterns.

After attribution is complete, cases split into two different processing paths[2].

![Processing paths after attribution. After attribution, a case is first checked to determine whether the problem is real and whether the current scoring rules accurately represent the risk. It then splits into two paths: Agent-related problems enter Agent performance iteration, proceeding through fix, backtest, and deployment; scoring-rule problems enter evaluation-system iteration, proceeding through sample revision, rule adjustment, and re-evaluation](../images/two-iteration-loops.png)

Caption: The same case can lead to two different iteration paths; the first step is to determine whether the problem lies in the Agent or in the judging standard. Image from [2].

The first path is Agent-performance iteration, where the object being optimized is the Agent itself and the sequence is fix, backtest, and deploy. The second path is evaluation-system iteration, where the objects being optimized are evaluation samples and judging standards and the sequence is revise samples, adjust rules, and rerun evaluation[2]. The two paths share the same entry point and ultimately converge on the evaluation suite as a common asset: the first path adds the fixed case back into the suite, while the second corrects the standard itself. Following only the first path causes the team to treat judging errors as capability problems over the long term; following only the second means real capability weaknesses never get fixed.

## 5.4 Converting Cases into Regression Tasks

Confirmed cases still contain production-specific accidental conditions and cannot be used directly as tests. Regression-task conversion rewrites them into tasks that can run independently and be judged repeatedly, turning a one-time production problem into offline evidence that can be executed again and again[1][5][4]. This is the most concentrated investment point in the entire pipeline: the quality of the conversion determines whether the case protects capability afterward or merely creates noise.

### 5.4.1 Reconstructing the Task Specification

Reconstruction means completing a full task specification. The original case already contains the input and execution record; what it lacks are the pieces needed to run independently.

What should be preserved is the case’s original input, the context available at the time, the environment’s initial state, and the production record from which it came. The provenance identifier should remain so that when the task fails in the future, the team can trace it back to the original production issue.

Three things need to be added: the standard for what counts as task completion, the boundaries that must not be crossed during execution, and the evidence to read during judging. After these are added, one more question must be confirmed: can an Agent that follows the instructions actually pass the task[1][3]? If even correct execution cannot pass, the rewritten specification is flawed; the problem is not with the Agent under test.

There are three possible sources of grading evidence: a human-corrected output, a reference answer, and the final state[1][3]. When environment state can be verified, it should be preferred because it does not depend on judging response wording.

One type of case needs separate handling: if the evidence is insufficient to support a judgment, do not rewrite it into an automated regression task; retain it for human review[1]. The reason is repeatability. A task with unclear judging standards only injects noise into every subsequent backtest, and that noise gradually erodes the team’s trust in the scores.

### 5.4.2 Updating the Evaluation Suite

Where a converted case should go is determined by the attribution result.

A fixed negative case goes into the regression suite, where its purpose is to prevent the same failure from shipping again. A difficult case that has not yet been fixed remains in the capability suite, where its purpose is to record the current capability boundary and provide a target for the next round of improvement[1][2]. These two routes correspond to the score characteristics of the two suite types: the regression suite should have a pass rate close to 100%, while the capability suite may start with a relatively low pass rate.

Positive cases are used to add high-quality references and expected behaviors so that “what level counts as good” has concrete examples. If a case exposes a problem in a process stage, a corresponding process-evaluation task should also be added; adding only an end-to-end task will not make the cause diagnosable.

If the case exposes a gap in the scoring rules themselves, more than the task needs to change: the task specification, scoring rules, and reference annotations must all be updated together[2]. Changing the task without changing the rules means the same kind of failure still cannot be detected next time.

The destinations of the three kinds of cases and the role of each resulting asset are shown below.

![Where Good Cases and Bad Cases are retained. Good Cases enter the golden set, defining what good looks like as a positive quality benchmark; they are run in every backtest and used as core inspection samples. High-difficulty Good Cases enter the challenge set, marking capability boundaries; they are not used as release gates and are used to observe capability jumps between versions. Bad Cases enter the error set, recording previously encountered failures to prevent recurrence; future versions must repeatedly run regression tests on them, and after a fix they move from previously failing to mandatory-pass items](../images/good-bad-case-assets.png)

Caption: The three types of cases are retained as three types of assets, each with a different purpose and usage pattern. Image from [2].

There is one key distinction in this diagram: the challenge set is not used as a release gate. The purpose of high-difficulty cases is to observe capability jumps between versions. If they are turned into release thresholds, the same hard problem will block the team every time and eliminate the room needed to observe capability change[2].

## 5.5 Evaluation-Suite Maintenance

An evaluation suite is a living collection and retains decision value only through continuous maintenance.

The first maintenance task is to keep a change log. Every time a task is added, revised, archived, or deleted, record the source case, reason for the change, task and environment versions, and the latest review result[1][3]. These four categories answer four questions: where did this task come from, why was it added, which versions of the environment and data is it tied to, and when was it last confirmed to still be valid?

The second task is to re-review the suite when external conditions change. After business rules, tool interfaces, environment data, or the distribution of user tasks changes, the relevant tasks, graders, and release baselines all need to be reconfirmed[1][2]. Such changes silently invalidate the assumptions underlying old conclusions. Without re-review, the invalidation goes unnoticed, and stale scores do not turn red by themselves.

The third task is to bring domain experts into the process. Domain experts are closest to the real success criteria and should participate in task contribution and case review[1][2]. The reason follows directly from the attribution layers: for problems at the intent-understanding and knowledge/data layers, the judging standard is inherently held by the business side, and only domain experts can confirm whether a case truly counts as a failure. Without this step, attribution oscillates across the first two layers and never reaches the real cause.

Once the mechanism is operating, case conversion is no longer a one-off project but a path that can be connected automatically. When an online grader flags a suspicious execution record, that record can be added directly to the dataset and become the basis for a regression test. After the defect is fixed, it stays fixed because the failure scenario has been permanently retained in the test suite[5]. The same can be done manually; the difference is cost. Automation simply removes the need for a person to initiate the path.

Chapter 1 produced the success criteria, Chapter 2 turned them into task specifications, Chapter 3 attached graders, and Chapter 4 organized them into comparable experiments and release gates. This chapter sends new production problems back into the input of Chapter 2. Tasks, graders, experiments, and production feedback thereby form a continuously updating loop rather than a one-time inspection.

## References

1. Anthropic. [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). `Capability vs. regression evals`, `Step 6: Check the transcripts`, `Step 8: Keep evaluation suites healthy long-term through open contribution and maintenance`, `How evals fit with other methods for a holistic understanding of agents`.
2. Meituan Tech Team. [Agent Evaluation White Paper Series 01: An Overview of Agent Evaluation](https://tech.meituan.com/2026/09/10/Agent-Evaluation-White-Paper-01.html). `II. Offline Evaluation: Gating Changes`, `III. Online Evaluation and Online Monitoring: Feedback from the Real World`, `4.1 Four Major Sources for Case Mining`, `4.2 Splitting the Case Pool: Good Cases and Bad Cases`, `4.3 Attribution: From "Something Went Wrong Here" to "Why Did It Go Wrong?"`.
3. Langfuse. [Evaluate Production Traffic](https://langfuse.com/docs/evaluation/get-started/online). `Manual setup`, `Other ways to score live traffic`.
4. OpenAI. [Build an Agent Improvement Loop with Traces, Evals, and Codex](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop). `What you will build`, `Failure modes to watch for`.
5. LangChain. [Evaluating AI Agents at the Run, Trace, and Thread Level](https://www.langchain.com/resources/agent-evals). `Human review that scales`, `Closing the loop`.
6. Meituan Tech Team. [Agent Evaluation: A Practical Guide from Fundamentals to Advanced Practice](https://tech.meituan.com/2026/08/07/Agent-Evaluation.html). `2.4 Agent evaluation is an empirical discipline`.
