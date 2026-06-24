using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using serverApi.Data;
using serverApi.Models;
using serverApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApartmentContext _context;
    private readonly IAuthService _authService;
    private readonly ITokenService _tokenService;

    public AuthController(ApartmentContext context, IAuthService authService, ITokenService tokenService)
    {
        _context = context;
        _authService = authService;
        _tokenService = tokenService;
    }

    // ================= LOGIN =================
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.Login(dto.UserName, dto.Password);
        if (result == null)
            return Unauthorized(new { code = "INVALID_CREDENTIALS" });

        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(new { token = result.AccessToken, userId = result.User.UserId, userName = result.User.UserName });
    }

    // ================= REGISTER =================
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var result = await _authService.Register(dto);
        if (result == null)
            return BadRequest(new { code = "USER_ALREADY_EXISTS" });

        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(new { token = result.AccessToken, userId = result.User.UserId, userName = result.User.UserName });
    }

    // ================= REFRESH TOKEN =================
    /// <summary>
    /// מקבל Refresh Token מה-cookie ומחזיר Access Token חדש
    /// </summary>
    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new { code = "NO_REFRESH_TOKEN" });

        var storedToken = await _context.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshToken);

        if (storedToken == null || storedToken.IsRevoked || storedToken.Expires < DateTime.UtcNow)
            return Unauthorized(new { code = "INVALID_REFRESH_TOKEN" });

        // ביטול ה-refresh token הישן (rotation)
        storedToken.IsRevoked = true;
        storedToken.RevokedAt = DateTime.UtcNow;

        // יצירת חדשים
        var newAccessToken = _tokenService.CreateToken(storedToken.User);
        var newRefreshToken = _tokenService.CreateRefreshToken();
        newRefreshToken.UserId = storedToken.User.UserId;
        newRefreshToken.ReplacedByToken = newRefreshToken.Token;

        _context.RefreshTokens.Add(newRefreshToken);
        await _context.SaveChangesAsync();

        SetRefreshTokenCookie(newRefreshToken.Token);
        return Ok(new { token = newAccessToken });
    }

    // ================= LOGOUT =================
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(refreshToken))
        {
            var storedToken = await _context.RefreshTokens
                .FirstOrDefaultAsync(r => r.Token == refreshToken);
            if (storedToken != null)
            {
                storedToken.IsRevoked = true;
                storedToken.RevokedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }
        Response.Cookies.Delete("refreshToken");
        return Ok(new { message = "Logged out successfully" });
    }

    // ================= GET USER =================
    [HttpGet("{identifier}")]
    public async Task<IActionResult> GetUser(string identifier)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserName == identifier || x.EmailAddress == identifier);

        if (user == null)
            return NotFound();

        return Ok(new { userId = user.UserId, userName = user.UserName, email = user.EmailAddress });
    }

    // ================= HELPER =================
    private void SetRefreshTokenCookie(string token)
    {
        Response.Cookies.Append("refreshToken", token, new CookieOptions
        {
            HttpOnly = true,   // לא נגיש ל-JavaScript
            Secure = true,     // HTTPS בלבד
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });
    }
}
