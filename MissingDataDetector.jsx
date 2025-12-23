import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, FileText, Sparkles, Download } from 'lucide-react';

export default function MissingDataDetector() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState(null);
  const [filledData, setFilledData] = useState(null);
  const [filling, setFilling] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setFilledData(null);
    setShowPreview(false);

    try {
      const text = await uploadedFile.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || null;
        });
        rows.push(row);
      }

      setRawData({ headers, rows });

      const columnStats = {};
      headers.forEach(header => {
        const missingCount = rows.filter(row => 
          !row[header] || row[header] === '' || row[header] === 'null' || row[header] === 'NA'
        ).length;
        const missingPercentage = ((missingCount / rows.length) * 100).toFixed(1);
        
        columnStats[header] = {
          total: rows.length,
          missing: missingCount,
          percentage: parseFloat(missingPercentage),
          present: rows.length - missingCount
        };
      });

      setAnalysis({
        fileName: uploadedFile.name,
        totalRows: rows.length,
        totalColumns: headers.length,
        columnStats,
        headers
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file. Please ensure it\'s a valid CSV.');
    } finally {
      setLoading(false);
    }
  };

  const detectColumnType = (header, values) => {
    const nonNullValues = values.filter(v => v && v !== '' && v !== 'null' && v !== 'NA');
    if (nonNullValues.length === 0) return 'unknown';

    const sample = nonNullValues.slice(0, Math.min(10, nonNullValues.length));
    
    const numericCount = sample.filter(v => !isNaN(parseFloat(v))).length;
    if (numericCount / sample.length > 0.8) return 'numeric';
    
    const dateCount = sample.filter(v => !isNaN(Date.parse(v))).length;
    if (dateCount / sample.length > 0.8) return 'date';
    
    return 'categorical';
  };

  const fillMissingValues = () => {
    if (!rawData) return;
    
    setFilling(true);
    
    setTimeout(() => {
      const { headers, rows } = rawData;
      const filledRows = JSON.parse(JSON.stringify(rows));
      const fillReport = {};

      headers.forEach(header => {
        const values = rows.map(row => row[header]);
        const columnType = detectColumnType(header, values);
        const nonNullValues = values.filter(v => v && v !== '' && v !== 'null' && v !== 'NA');
        
        const missingCount = rows.filter(row => 
          !row[header] || row[header] === '' || row[header] === 'null' || row[header] === 'NA'
        ).length;

        if (missingCount > 0) {
          let fillValue;
          let method;
          let details;

          if (columnType === 'numeric') {
            const numericValues = nonNullValues.map(v => parseFloat(v)).filter(v => !isNaN(v));
            const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
            fillValue = mean.toFixed(2);
            method = 'Mean Imputation';
            details = `Filled with average value: ${fillValue}`;
          } else if (columnType === 'categorical') {
            const frequency = {};
            nonNullValues.forEach(v => {
              frequency[v] = (frequency[v] || 0) + 1;
            });
            fillValue = Object.keys(frequency).reduce((a, b) => 
              frequency[a] > frequency[b] ? a : b
            );
            method = 'Mode Imputation';
            details = `Filled with most frequent value: "${fillValue}"`;
          } else {
            fillValue = 'UNKNOWN';
            method = 'Placeholder';
            details = 'Filled with "UNKNOWN" placeholder';
          }

          fillReport[header] = {
            method,
            details,
            fillValue,
            columnType,
            filledCount: missingCount
          };

          filledRows.forEach((row, idx) => {
            if (!row[header] || row[header] === '' || row[header] === 'null' || row[header] === 'NA') {
              filledRows[idx][header] = fillValue;
            }
          });
        }
      });

      setFilledData({ headers, rows: filledRows, fillReport });
      setFilling(false);
    }, 1500);
  };

  const downloadFilledCSV = () => {
    if (!filledData) return;

    const { headers, rows } = filledData;
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += headers.map(h => row[h] || '').join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'cleaned_' + (file?.name || 'data.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getSeverityColor = (percentage) => {
    if (percentage === 0) return 'bg-green-100 border-green-300';
    if (percentage < 10) return 'bg-yellow-50 border-yellow-300';
    if (percentage < 30) return 'bg-orange-50 border-orange-300';
    return 'bg-red-50 border-red-300';
  };

  const getSeverityIcon = (percentage) => {
    if (percentage === 0) return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            AI Data Cleaner
          </h1>
          <p className="text-gray-600">
            Upload your CSV file to detect and automatically fix missing values
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <label 
            htmlFor="file-upload" 
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all"
          >
            <Upload className="w-16 h-16 text-gray-400 mb-4" />
            <span className="text-lg font-medium text-gray-700 mb-2">
              {file ? file.name : 'Click to upload CSV file'}
            </span>
            <span className="text-sm text-gray-500">
              Supports CSV files only
            </span>
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing your data...</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-indigo-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-800">Analysis Results</h2>
              </div>
              
              {!filledData && Object.values(analysis.columnStats).some(s => s.missing > 0) && (
                <button
                  onClick={fillMissingValues}
                  disabled={filling}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" />
                  {filling ? 'Filling...' : 'AI Fill Missing Values'}
                </button>
              )}

              {filledData && (
                <button
                  onClick={downloadFilledCSV}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download Cleaned CSV
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {analysis.totalRows}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Rows</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {analysis.totalColumns}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Columns</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">
                  {Object.values(analysis.columnStats).filter(s => s.missing > 0).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Columns with Missing Data</div>
              </div>
            </div>

            {filledData && (
              <div className="mb-6">
                <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-800 mb-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Data Cleaned Successfully!</span>
                  </div>
                  <p className="text-green-700 text-sm">
                    {Object.keys(filledData.fillReport || {}).length} column(s) have been automatically fixed.
                  </p>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="mt-3 text-sm text-green-700 underline hover:text-green-800"
                  >
                    {showPreview ? 'Hide' : 'Show'} Data Preview
                  </button>
                </div>

                {showPreview && rawData && filledData && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 overflow-x-auto">
                    <h4 className="font-semibold text-gray-800 mb-3">Data Preview (First 5 rows)</h4>
                    
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Before (Original Data)</h5>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              {rawData.headers.map((header, i) => (
                                <th key={i} className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rawData.rows.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                {rawData.headers.map((header, i) => {
                                  const value = row[header];
                                  const isMissing = !value || value === '' || value === 'null' || value === 'NA';
                                  return (
                                    <td 
                                      key={i}
                                      className={`border border-gray-300 px-3 py-2 ${isMissing ? 'bg-red-50 text-red-600 font-medium' : ''}`}
                                    >
                                      {isMissing ? '[MISSING]' : value}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">After (Cleaned Data)</h5>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              {filledData.headers.map((header, i) => (
                                <th key={i} className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filledData.rows.slice(0, 5).map((row, idx) => {
                              const originalRow = rawData.rows[idx];
                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  {filledData.headers.map((header, i) => {
                                    const value = row[header];
                                    const originalValue = originalRow[header];
                                    const wasMissing = !originalValue || originalValue === '' || originalValue === 'null' || originalValue === 'NA';
                                    return (
                                      <td 
                                        key={i}
                                        className={`border border-gray-300 px-3 py-2 ${wasMissing ? 'bg-green-50 text-green-700 font-medium' : ''}`}
                                      >
                                        {value || ''}
                                        {wasMissing && <span className="text-xs ml-1">(filled)</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {filledData.fillReport && Object.keys(filledData.fillReport).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      What We Fixed
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(filledData.fillReport).map(([column, report]) => (
                        <div key={column} className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-medium text-gray-800">{column}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {report.columnType}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            <span className="font-medium text-blue-600">{report.method}</span>: {report.details}
                          </div>
                          <div className="text-xs text-gray-500">
                            Filled {report.filledCount} missing value{report.filledCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Column Details
            </h3>
            <div className="space-y-3">
              {Object.entries(analysis.columnStats)
                .sort((a, b) => b[1].percentage - a[1].percentage)
                .map(([column, stats]) => (
                  <div 
                    key={column}
                    className={`border rounded-lg p-4 ${getSeverityColor(stats.percentage)}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(stats.percentage)}
                        <span className="font-semibold text-gray-800">
                          {column}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {stats.percentage}% missing
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>
                        Missing: <span className="font-medium text-red-600">{stats.missing}</span>
                      </span>
                      <span>
                        Present: <span className="font-medium text-green-600">{stats.present}</span>
                      </span>
                      <span>
                        Total: {stats.total}
                      </span>
                    </div>

                    <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-red-500 h-full transition-all"
                        style={{ width: `${stats.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
