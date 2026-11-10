import { useState, useCallback, useRef } from 'react'
import './App.css'

const SAMPLE_LOGS = [
  {
    name: 'NullPointerException',
    content: `2024-01-15 10:23:45.123 ERROR [main] c.l.s.LogProcessor - Failed to process log entry
java.lang.NullPointerException: Cannot invoke "com.logdetective.service.LogParser.parse(String)" because "this.parser" is null
    at com.logdetective.service.LogProcessor.process(LogProcessor.java:34)
    at com.logdetective.service.LogProcessor.processBatch(LogProcessor.java:52)
    at com.logdetective.Application.main(Application.java:18)
Caused by: java.lang.IllegalStateException: LogParser not initialized
    at com.logdetective.service.LogProcessor.<init>(LogProcessor.java:21)`
  },
  {
    name: 'Database Connection Pool Exhausted',
    content: `2024-01-15 14:32:10.456 WARN  [http-nio-8080-exec-3] com.zaxxer.hikari.HikariCP - Pool HikariPool-1 is not ready, waiting for connection
2024-01-15 14:32:20.458 ERROR [http-nio-8080-exec-3] c.l.r.UserController - Failed to fetch user profile
org.springframework.jdbc.CannotGetJdbcConnectionException: Failed to obtain JDBC Connection
    at org.springframework.jdbc.datasource.DataSourceUtils.getConnection(DataSourceUtils.java:83)
    at org.springframework.jdbc.core.JdbcTemplate.execute(JdbcTemplate.java:324)
Caused by: java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30000ms
    at com.zaxxer.hikari.pool.HikariPool.createTimeoutException(HikariPool.java:695)
    at com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)
2024-01-15 14:32:20.460 WARN  [http-nio-8080-exec-3] c.l.r.UserController - Retrying... (attempt 1/3)`
  },
  {
    name: 'OutOfMemoryError - Heap Space',
    content: `2024-01-15 09:15:22.789 INFO  [GC Thread] - GC(123) Pause Young (Normal) (G1 Evacuation Pause) 245M->238M(512M) 45.23ms
2024-01-15 09:15:23.102 INFO  [GC Thread] - GC(124) Pause Young (Normal) (G1 Evacuation Pause) 248M->242M(512M) 52.11ms
2024-01-15 09:15:23.456 ERROR [main] c.l.b.DataProcessor - Failed to process batch
java.lang.OutOfMemoryError: Java heap space
    at java.util.Arrays.copyOf(Arrays.java:3236)
    at java.lang.StringBuilder.toString(StringBuilder.java:434)
    at com.logdetective.batch.DataProcessor.transform(DataProcessor.java:127)
    at com.logdetective.batch.BatchJob.execute(BatchJob.java:45)
2024-01-15 09:15:23.458 ERROR [main] - JVM will exit due to OutOfMemoryError`
  },
  {
    name: 'Spring Bean Circular Dependency',
    content: `2024-01-15 16:45:33.210 ERROR [main] o.s.b.d.LoggingFailureAnalysisReporter - 
***************************
APPLICATION FAILED TO START
***************************
Description:
The dependencies of some of the beans in the application context form a cycle:
\u250C\u2500\u2192\u2500\u2510
|  userService defined in file [/app/com/logdetective/service/UserService.class]
\u2191     \u2193
|  orderService defined in file [/app/com/logdetective/service/OrderService.class]
\u2514\u2500\u2190\u2500\u2518
Action:
Relying on circular references is discouraged and they will be prohibited in a future release.
Consider using @Lazy or refactoring to eliminate the cycle.`
  }
]

const SEVERITY_LEVELS = {
  CRITICAL: { label: 'Critical', color: '#ef4444', bg: '#7f1d1d', border: '#ef4444' },
  HIGH: { label: 'High', color: '#f97316', bg: '#7c2d12', border: '#f97316' },
  MEDIUM: { label: 'Medium', color: '#f59e0b', bg: '#78350f', border: '#f59e0b' },
  LOW: { label: 'Low', color: '#3b82f6', bg: '#1e3a5f', border: '#3b82f6' }
}

function App() {
  const [logInput, setLogInput] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const abortControllerRef = useRef(null)

  const mockAnalysis = {
    exceptionSummary: 'NullPointerException at com.logdetective.service.LogParser.parse(LogParser.java:42) - Attempt to invoke virtual method on a null object reference',
    severity: 'HIGH',
    rootCauses: [
      { hypothesis: 'Uninitialized LogParser instance due to missing @Autowired annotation', evidence: 'Stack trace shows "this.parser is null" at LogProcessor.java:34' },
      { hypothesis: 'Race condition in LogProcessor initialization order', evidence: 'LogProcessor constructed before LogParser bean registered in Spring context' },
      { hypothesis: 'Configuration property log.parser.enabled defaulting to false in application.yml', evidence: 'Default configuration disables parser auto-registration' }
    ],
    debuggingSteps: [
      'Verify LogParser bean is registered in Spring context via @Component or @Bean',
      'Check application.yml for log.parser.enabled=true',
      'Add null-check guard in LogProcessor.process() before calling parser.parse()',
      'Enable DEBUG logging for com.logdetective package to trace initialization sequence',
      'Run with --debug flag to see bean creation order'
    ],
    suggestedFixes: [
      { title: 'Add @Autowired to LogParser field', file: 'LogProcessor.java', line: 21, code: '@Autowired\nprivate LogParser parser;' },
      { title: 'Enable parser in configuration', file: 'application.yml', line: 12, code: 'log:\n  parser:\n    enabled: true' },
      { title: 'Add null-safety guard', file: 'LogProcessor.java', line: 34, code: 'if (parser == null) {\n  throw new IllegalStateException("Parser not initialized");\n}' }
    ]
  }

  const handleAnalyze = useCallback(async () => {
    if (!logInput.trim()) {
      setError('Please enter log content to analyze')
      return
    }
    if (isAnalyzing) return

    setIsAnalyzing(true)
    setIsLoading(true)
    setError(null)
    setAnalysisResult(null)

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logInput }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Analysis failed: ${response.status}`)
      }

      const data = await response.json()
      setAnalysisResult({ ...data, isMock: false })
    } catch (err) {
      if (err.name === 'AbortError') return
      
      console.warn('Backend unavailable, using mock analysis:', err.message)
      await new Promise(resolve => setTimeout(resolve, 1500))
      setAnalysisResult({ ...mockAnalysis, isMock: true })
      setError('Using demo analysis (backend unavailable). Configure FreeLLM for real AI insights.')
    } finally {
      setIsLoading(false)
      setIsAnalyzing(false)
    }
  }, [logInput, isAnalyzing])

  const handleClear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setLogInput('')
    setAnalysisResult(null)
    setError(null)
    setIsAnalyzing(false)
    setIsLoading(false)
  }, [])

  const handleLoadSample = useCallback((sample) => {
    setLogInput(sample.content)
    setAnalysisResult(null)
    setError(null)
  }, [])

  const handleCopyResults = useCallback(() => {
    if (!analysisResult) return
    const text = formatResultsForCopy(analysisResult)
    navigator.clipboard.writeText(text)
    setError('Results copied to clipboard!')
    setTimeout(() => setError(null), 3000)
  }, [analysisResult])

  const formatResultsForCopy = (result) => {
    let output = 'AI LOG DETECTIVE - ANALYSIS RESULTS\n'
    output += '='.repeat(50) + '\n\n'
    
    if (result.severity) {
      output += `Severity: ${result.severity}\n\n`
    }
    
    output += 'EXCEPTION SUMMARY:\n'
    output += '-'.repeat(20) + '\n'
    output += result.exceptionSummary + '\n\n'
    
    if (result.rootCauses?.length) {
      output += 'ROOT CAUSE HYPOTHESES:\n'
      output += '-'.repeat(20) + '\n'
      result.rootCauses.forEach((rc, i) => {
        output += `${i + 1}. ${rc.hypothesis}\n`
        if (rc.evidence) output += `   Evidence: ${rc.evidence}\n`
      })
      output += '\n'
    }
    
    if (result.debuggingSteps?.length) {
      output += 'DEBUGGING STEPS:\n'
      output += '-'.repeat(20) + '\n'
      result.debuggingSteps.forEach((step, i) => {
        output += `${i + 1}. ${step}\n`
      })
      output += '\n'
    }
    
    if (result.suggestedFixes?.length) {
      output += 'SUGGESTED FIXES:\n'
      output += '-'.repeat(20) + '\n'
      result.suggestedFixes.forEach((fix, i) => {
        output += `${i + 1}. ${fix.title} (${fix.file}:${fix.line})\n`
        output += `   ${fix.code}\n\n`
      })
    }
    
    if (result.isMock) {
      output += '\n[NOTE: This was a demonstration/mock analysis. Configure FreeLLM for real AI insights.]\n'
    }
    
    return output
  }

  const severity = analysisResult?.severity ? SEVERITY_LEVELS[analysisResult.severity] : null

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#1e293b"/>
              <path d="M8 12h16M8 16h12M8 20h8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="24" r="4" fill="#22c55e"/>
            </svg>
            <span className="logo-text">AI Log Detective</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <h3 className="nav-title">Samples</h3>
            <ul className="nav-list">
              {SAMPLE_LOGS.map((sample, i) => (
                <li key={i}>
                  <button
                    className="nav-item"
                    onClick={() => handleLoadSample(sample)}
                    disabled={isAnalyzing}
                    title={`Load ${sample.name} sample`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 7h6v6H7z" fill="currentColor"/>
                    </svg>
                    {sample.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="nav-section">
            <h3 className="nav-title">Quick Actions</h3>
            <ul className="nav-list">
              <li>
                <button className="nav-item" onClick={handleClear} disabled={isAnalyzing && !logInput && !analysisResult}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M5 4v10a1 1 0 001 1h4a1 1 0 001-1V4M9 4V2a1 1 0 011-1h1a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Clear All
                </button>
              </li>
              {analysisResult && (
                <li>
                  <button className="nav-item" onClick={handleCopyResults} disabled={isAnalyzing}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3h8v8H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 7h6v6H7z" fill="currentColor"/>
                    </svg>
                    Copy Results
                  </button>
                </li>
              )}
            </ul>
          </div>
        </nav>
        <div className="sidebar-footer">
          <p className="version">v1.0.0-beta</p>
          <p className="hint">Configure FreeLLM for AI analysis</p>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="header">
          <div className="header-content">
            <h1>Log Analysis</h1>
            <p className="tagline">Paste logs. Get insights. Fix faster.</p>
          </div>
          <div className="header-actions">
            {analysisResult && severity && (
              <span className="severity-badge" style={{ background: severity.bg, color: severity.color, borderColor: severity.border }}>
                {severity.label}
              </span>
            )}
          </div>
        </header>

        <main className="main">
          <div className="container">
            <section className="input-section" aria-label="Log input">
              <div className="section-header">
                <h2>Log Input</h2>
                <span className="char-count">{logInput.length} characters</span>
              </div>
              <textarea
                className="log-textarea"
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                placeholder="Paste your Java stack traces, application logs, or error messages here..."
                rows={20}
                spellCheck={false}
                disabled={isAnalyzing}
                aria-describedby="input-hint"
              />
              <div id="input-hint" className="input-hint">
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to analyze \u2022 <kbd>Esc</kbd> to clear
              </div>
              <div className="input-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !logInput.trim()}
                  aria-busy={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Logs'
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleClear}
                  disabled={isAnalyzing}
                >
                  Clear
                </button>
              </div>
              {error && (
                <div className="error-banner" role="alert">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </section>

            {analysisResult && (
              <section className="result-section" aria-live="polite" aria-label="Analysis results">
                <div className="result-header">
                  <h2>Analysis Result</h2>
                  <div className="result-meta">
                    {analysisResult.isMock && (
                      <span className="mock-badge">Demo Analysis</span>
                    )}
                    {!analysisResult.isMock && (
                      <span className="live-badge">AI Analysis</span>
                    )}
                  </div>
                </div>
                
                <div className="result-card">
                  <div className="result-item">
                    <div className="result-label">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                        <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9 11.25a.75.75 0 00-.75.75v2.25a.75.75 0 001.5 0v-2.25A.75.75 0 009 11.25zM9 4.5a.75.75 0 01.75-.75h.008v.008H9.75A.75.75 0 019 5.25v.008H9V4.5z" fill="#ef4444"/>
                      </svg>
                      Exception Summary
                    </div>
                    <div className="result-value exception">{analysisResult.exceptionSummary}</div>
                  </div>

                  {analysisResult.rootCauses?.length && (
                    <div className="result-item">
                      <div className="result-label">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9 11.25a.75.75 0 00-.75.75v2.25a.75.75 0 001.5 0v-2.25A.75.75 0 009 11.25zM9 4.5a.75.75 0 01.75-.75h.008v.008H9.75A.75.75 0 019 5.25v.008H9V4.5z" fill="#f59e0b"/>
                        </svg>
                        Root Cause Hypotheses
                      </div>
                      <ul className="result-list hypotheses">
                        {analysisResult.rootCauses.map((cause, i) => (
                          <li key={i}>
                            <div className="hypothesis-main">{cause.hypothesis}</div>
                            {cause.evidence && (
                              <div className="hypothesis-evidence">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                  <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                                  <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                Evidence: {cause.evidence}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisResult.debuggingSteps?.length && (
                    <div className="result-item">
                      <div className="result-label">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9 11.25a.75.75 0 00-.75.75v2.25a.75.75 0 001.5 0v-2.25A.75.75 0 009 11.25zM9 4.5a.75.75 0 01.75-.75h.008v.008H9.75A.75.75 0 019 5.25v.008H9V4.5z" fill="#3b82f6"/>
                        </svg>
                        Debugging Steps
                      </div>
                      <ol className="result-list numbered">
                        {analysisResult.debuggingSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {analysisResult.suggestedFixes?.length && (
                    <div className="result-item">
                      <div className="result-label">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                          <path d="M9 1.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM9 11.25a.75.75 0 00-.75.75v2.25a.75.75 0 001.5 0v-2.25A.75.75 0 009 11.25zM9 4.5a.75.75 0 01.75-.75h.008v.008H9.75A.75.75 0 019 5.25v.008H9V4.5z" fill="#22c55e"/>
                        </svg>
                        Suggested Fixes
                      </div>
                      <div className="fixes-list">
                        {analysisResult.suggestedFixes.map((fix, i) => (
                          <div key={i} className="fix-item">
                            <div className="fix-header">
                              <span className="fix-title">{fix.title}</span>
                              <span className="fix-location">{fix.file}:{fix.line}</span>
                            </div>
                            <pre className="fix-code"><code>{fix.code}</code></pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="result-footer">
                  <button className="btn btn-ghost" onClick={handleClear}>New Analysis</button>
                  <button className="btn btn-secondary" onClick={handleCopyResults}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 3h8v8H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M7 7h6v6H7z" fill="currentColor"/>
                    </svg>
                    Copy Results
                  </button>
                </div>
              </section>
            )}

            {!analysisResult && !isAnalyzing && !logInput.trim() && (
              <section className="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <rect width="64" height="64" rx="12" fill="var(--bg-tertiary)"/>
                  <path d="M16 20h32M16 32h24M16 44h16" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="44" cy="44" r="8" fill="var(--accent-green)"/>
                </svg>
                <h3>Ready to analyze</h3>
                <p>Paste logs in the input area or load a sample from the sidebar</p>
              </section>
            )}
          </div>
        </main>

        <footer className="footer">
          <p>AI Log Detective \u2014 Analyze logs with AI-powered insights</p>
        </footer>
      </div>
    </div>
  )
}

export default App
