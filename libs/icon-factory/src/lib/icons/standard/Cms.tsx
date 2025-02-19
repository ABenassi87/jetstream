import * as React from 'react';

function SvgCms(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M60.4 29.9c-2 0-3.8.2-5.5.8 2.1 1.7 3.9 3.8 5.4 6.1h.1c7 0 12.7 5.7 12.7 12.7s-5.7 12.7-12.7 12.7c-1.7 0-3.5-.3-5-1 .9-1.3 1.7-2.7 2.3-4 .2-.6.5-1 .6-1.6.6-1.8.9-3.9.9-6 0-10.8-8.8-19.6-19.6-19.6S20 38.7 20 49.5s8.8 19.6 19.6 19.6c2 0 3.8-.2 5.5-.8-2.1-1.7-3.9-3.8-5.4-6.1h-.1c-7 0-12.7-5.7-12.7-12.7s5.7-12.7 12.7-12.7c1.7 0 3.5.3 5.1 1-2.4 3.2-3.9 7.3-3.9 11.7 0 10.8 8.8 19.6 19.6 19.6S80 60.3 80 49.5s-8.8-19.6-19.6-19.6z"
      />
    </svg>
  );
}

export default SvgCms;
