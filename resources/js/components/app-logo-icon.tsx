import { SVGAttributes } from 'react';

export default function AppLogoIcon({ style, ...props }: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ ...style, fill: 'none' }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M3 12h4l2-5 3 10 3-7 2 2h4" />
        </svg>
    );
}
