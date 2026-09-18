import React from 'react';
import CodeViewer from './CodeViewer';

export default function JsonViewer({
  data,
  title = 'JSON Estruturado',
  maxHeight = '280px'
}) {
  const jsonString = React.useMemo(() => {
    if (!data) return '{}';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch (_) {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }, [data]);

  return (
    <CodeViewer
      code={jsonString}
      language="json"
      title={title}
      maxHeight={maxHeight}
    />
  );
}
