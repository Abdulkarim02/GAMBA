# GAMBA

## Activity Flow

1. User visits a website
1. Frontend extracts html and preprocesses$_{[1]}$ it
1. Frontend extracts scripts and proprocesses$_{[2]}$ them
1. Frontend sends html to Backend to receive `html_response`$_{[3]}$
1. Frontend sends scripts to Backend to receive `scripts_response`$_{[4]}$
1. Frontend accepts feedback from the users$_{[5]}$

### 1 - HTML preprocessing

**This is not yet determined.**

Initially the frontend will create an "identity" function `preprocess_html` which will simply convert it to a string **as is** and return it.

We will later modify this function to optimize the model responses etc.

### 2 - Scripts preprocessing

**This is not yet determined.**

Initially the frontend will create an "identity" function `preprocess_scripts` which will return a list of strings which is each script converted to a string **as is** in arbitrary order.

We will later modify this function to optimize malware detection.

### 3 - `html_response`

|API endpoint| function | payload| 
|------------|----------|---------|
|`/api/process_html`| analyzes the `html` script and returns an `html_response` object| output of `frontend::preprocess_html`|

This should contain the results of the LLM's analysis of the `html` script including but not limited to:

- Category of the visited webpage *(education, news, shopping, ...)*
- Content analysis *(word count, image count, link count, ...)*
- List of modifications to be applied

### 4 - `scripts_response`

|API endpoint| function | payload| 
|------------|----------|---------|
|`/api/process_scripts`| analyzes the scripts and returns a `scripts_response` object| output of `frontend::preprocess_scripts`|

This should contain the results of the LLM's analysis of the scripts including but not limited to:

- List of probabilties of each script containing malware
- Severity of the webpage risk
- Suggested action

### 5 - Accepting Feedback

Fill this

## Webpage Modifications

This section discusses the format in which the backend will propose modifications to a webpage and how the frontend will apply them.

### Modifying a preexisting element

should we?

#### Addressing elements

how? 

### Inserting an element

should we?

#### Relative ordering

how? 

#### Inserting into tables

should we? how?



