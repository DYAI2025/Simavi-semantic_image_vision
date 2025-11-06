import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow health checks and API endpoints that don't require authentication
  if (request.nextUrl.pathname.startsWith('/api/health') || 
      request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // For all other routes, check for password
  const authHeader = request.headers.get('authorization');
  const expectedPassword = process.env.APP_PASSWORD || 'defaultpassword123';
  
  if (!authHeader || !isValidPassword(authHeader, expectedPassword)) {
    // Return 401 for API requests, redirect or show basic auth for UI
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse('Unauthorized', { status: 401 });
    } else {
      // For UI routes, prompt for basic auth
      const response = new NextResponse('Authentication required', { status: 401 });
      response.headers.set('WWW-Authenticate', 'Basic realm="Protected Area"');
      return response;
    }
  }

  return NextResponse.next();
}

function isValidPassword(authHeader: string, expectedPassword: string): boolean {
  try {
    if (!authHeader.startsWith('Basic ')) {
      return false;
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    // For simplicity, we're only checking the password
    // In a real application, you would hash and compare properly
    return password === expectedPassword;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
}

// Apply middleware to all routes except static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}